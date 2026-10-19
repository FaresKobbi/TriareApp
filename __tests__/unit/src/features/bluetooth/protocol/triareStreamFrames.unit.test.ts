import { RX_CHAR_UUID } from "@/src/features/bluetooth/constants/bleUUIDs";
import { NackReason, TelemetryStatus } from "@/src/features/bluetooth/constants/triareProtocol";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { base64ToBytes } from "@/src/features/bluetooth/utils/base64";

const codec = new TriareVescCodec();

describe("TriareVescCodec push frames", () => {
  it("encodes CMD_STREAM as opcode + 1/0", () => {
    expect(codec.encodeStream(true)).toEqual(Uint8Array.of(0x1c, 1));
    expect(codec.encodeStream(false)).toEqual(Uint8Array.of(0x1c, 0));
  });

  it("decodes a 27-byte STREAM_FRAME (timestamp @1, floats @5..21, fault @25, status @26)", async () => {
    // The simulator lays the frame out like the firmware; the codec must read it back.
    const firmware = new MockBleCharacteristicManager();
    const received: Uint8Array[] = [];
    firmware.subscribe("svc", RX_CHAR_UUID, (b64) => received.push(base64ToBytes(b64)));
    firmware.emitStreamFrame(
      { rpm: 1200, current: 3.5, voltage: 36.25, temp: 41.5, crankAngleDeg: 270, fault: 2 },
      123456,
      TelemetryStatus.ARMED | TelemetryStatus.DRIVING,
    );
    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(27);
    expect(codec.decode(received[0])).toEqual({
      kind: "stream",
      telemetry: {
        timestampMs: 123456,
        rpm: 1200,
        current: 3.5,
        voltage: 36.25,
        temp: 41.5,
        crankAngleDeg: 270,
        fault: 2,
        status: TelemetryStatus.ARMED | TelemetryStatus.DRIVING,
      },
    });
  });

  it("decodes STATUS_EVENT and NACK frames", () => {
    expect(codec.decode(Uint8Array.of(0x1e, 0x02))).toEqual({ kind: "status", status: 0x02 });
    expect(codec.decode(Uint8Array.of(0x1f, 0x12, NackReason.EMERGENCY_STOP))).toEqual({
      kind: "nack",
      rejectedOpcode: 0x12,
      reason: NackReason.EMERGENCY_STOP,
    });
  });

  it("treats a STREAM_FRAME shorter than 27 bytes as unrecognized", () => {
    const short = new Uint8Array(26);
    short[0] = 0x1d;
    expect(codec.decode(short).kind).toBe("unrecognized");
  });
});
