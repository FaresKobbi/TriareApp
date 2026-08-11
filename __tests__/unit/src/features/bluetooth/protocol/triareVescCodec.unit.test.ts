import { TriareOpcode } from "@/src/features/bluetooth/constants/triareProtocol";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";

const codec = new TriareVescCodec();

/** Builds a valid 18-byte telemetry frame the way the firmware does. */
function buildTelemetryFrame(
  rpm: number, current: number, voltage: number, temp: number, fault: number
): Uint8Array {
  const frame = new Uint8Array(18);
  const view = new DataView(frame.buffer);
  frame[0] = TriareOpcode.REQ_TELEMETRY;
  view.setFloat32(1, rpm, true);
  view.setFloat32(5, current, true);
  view.setFloat32(9, voltage, true);
  view.setFloat32(13, temp, true);
  frame[17] = fault;
  return frame;
}

describe("TriareVescCodec.encode", () => {
  it("encodes no-payload commands as a single opcode byte", () => {
    expect(codec.encodeGetDevEui()).toEqual(Uint8Array.of(0x01));
    expect(codec.encodeSystemEnable()).toEqual(Uint8Array.of(0x10));
    expect(codec.encodeSystemDisable()).toEqual(Uint8Array.of(0x11));
    expect(codec.encodeRequestTelemetry()).toEqual(Uint8Array.of(0x13));
    expect(codec.encodeStop()).toEqual(Uint8Array.of(0x16));
  });

  it("encodes SET_RPM as opcode + little-endian float32, matching struct.pack('<f')", () => {
    // python: struct.pack('<f', 1000.0) == b'\x00\x00\x7a\x44'
    expect(codec.encodeSetRpm(1000)).toEqual(
      Uint8Array.of(0x12, 0x00, 0x00, 0x7a, 0x44)
    );
  });

  it("encodes SET_DUTY as opcode + little-endian float32, matching struct.pack('<f')", () => {
    // python: struct.pack('<f', 0.08) == b'\x0a\xd7\xa3\x3d'
    expect(codec.encodeSetDuty(0.08)).toEqual(
      Uint8Array.of(0x15, 0x0a, 0xd7, 0xa3, 0x3d)
    );
  });

  it("accepts the SET_DUTY boundary values -1.0 and 1.0", () => {
    expect(codec.encodeSetDuty(-1.0)[0]).toBe(0x15);
    expect(codec.encodeSetDuty(1.0)[0]).toBe(0x15);
  });

  it("rejects SET_DUTY values outside [-1.0, 1.0]", () => {
    expect(() => codec.encodeSetDuty(1.01)).toThrow(RangeError);
    expect(() => codec.encodeSetDuty(-1.01)).toThrow(RangeError);
    expect(() => codec.encodeSetDuty(NaN)).toThrow(RangeError);
  });

  it("encodes ECHO as opcode + payload bytes", () => {
    const payload = new TextEncoder().encode("triare-ble");
    const frame = codec.encodeEcho(payload);
    expect(frame[0]).toBe(0x02);
    expect(frame.slice(1)).toEqual(payload);
  });
});

describe("TriareVescCodec.decode", () => {
  it("decodes [ACK, opcode] frames", () => {
    expect(codec.decode(Uint8Array.of(0x14, 0x10))).toEqual({
      kind: "ack",
      ackedOpcode: 0x10,
    });
  });

  it("decodes DevEUI response frames", () => {
    const devEui = Uint8Array.of(0x00, 0x80, 0xe1, 0x2c, 0x00, 0x00, 0x10, 0x8f);
    const frame = new Uint8Array([0x01, ...devEui]);
    const decoded = codec.decode(frame);
    expect(decoded.kind).toBe("devEui");
    if (decoded.kind === "devEui") expect(decoded.devEui).toEqual(devEui);
  });

  it("decodes ECHO response frames", () => {
    const payload = Uint8Array.of(0xde, 0xad, 0xbe, 0xef);
    const decoded = codec.decode(new Uint8Array([0x02, ...payload]));
    expect(decoded.kind).toBe("echo");
    if (decoded.kind === "echo") expect(decoded.payload).toEqual(payload);
  });

  it("decodes telemetry frames (floats at offsets 1/5/9/13, fault at 17)", () => {
    const decoded = codec.decode(buildTelemetryFrame(1000, 12.5, 36.5, 42.25, 3));
    expect(decoded).toEqual({
      kind: "telemetry",
      telemetry: { rpm: 1000, current: 12.5, voltage: 36.5, temp: 42.25, fault: 3 },
    });
  });

  it("decodes telemetry from a view into a larger buffer (non-zero byteOffset)", () => {
    // Simulates a frame arriving inside a larger native buffer.
    const padded = new Uint8Array(24);
    padded.set(buildTelemetryFrame(500, 1, 36, 25, 0), 4);
    const view = padded.subarray(4, 22);
    const decoded = codec.decode(view);
    expect(decoded.kind).toBe("telemetry");
    if (decoded.kind === "telemetry") expect(decoded.telemetry.rpm).toBe(500);
  });

  it("round-trips every ACK-framed opcode", () => {
    for (const opcode of [0x10, 0x11, 0x12, 0x15, 0x16]) {
      expect(codec.decode(Uint8Array.of(0x14, opcode))).toEqual({
        kind: "ack",
        ackedOpcode: opcode,
      });
    }
  });

  it.each([
    ["empty frame", new Uint8Array(0)],
    ["ACK missing echoed opcode", Uint8Array.of(0x14)],
    ["DevEUI frame too short", Uint8Array.of(0x01, 0xaa, 0xbb)],
    ["telemetry frame too short", buildTelemetryFrame(0, 0, 0, 0, 0).slice(0, 17)],
    ["unknown opcode", Uint8Array.of(0xff, 0x01, 0x02)],
  ])("returns an unrecognized frame instead of throwing: %s", (_name, raw) => {
    const decoded = codec.decode(raw);
    expect(decoded.kind).toBe("unrecognized");
    if (decoded.kind === "unrecognized") expect(decoded.raw).toEqual(raw);
  });
});
