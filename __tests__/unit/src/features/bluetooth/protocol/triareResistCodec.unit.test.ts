import {
  HOLD_MAX_CURRENT_A,
  NackReason,
  nackReasonName,
  ResistMode,
  TriareOpcode,
} from "@/src/features/bluetooth/constants/triareProtocol";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";

const codec = new TriareVescCodec();

function f32(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return Array.from(bytes);
}

describe("physiotherapy opcodes", () => {
  it("match the firmware", () => {
    expect(TriareOpcode.RESIST_MODE).toBe(0x20);
    expect(TriareOpcode.RESIST_ZONE).toBe(0x21);
    expect(TriareOpcode.RESIST_COMMIT).toBe(0x22);
    expect(TriareOpcode.RESIST_CLEAR).toBe(0x23);
    expect(TriareOpcode.HOLD_ENGAGE).toBe(0x24);
    expect(TriareOpcode.HOLD_RELEASE).toBe(0x25);
    expect(TriareOpcode.RESIST_GET).toBe(0x26);
    expect(TriareOpcode.RESIST_TUNE).toBe(0x27);
    expect(TriareOpcode.RESIST_FRAME).toBe(0x29);
    expect(NackReason.NO_REGEN_PATH).toBe(5);
    expect(nackReasonName(5)).toBe("no energy return path");
  });
});

describe("physiotherapy encoders", () => {
  it("encodes the mode as one byte and refuses unknown modes", () => {
    expect(codec.encodeResistMode(ResistMode.ASSIST_VALLEY)).toEqual(Uint8Array.of(0x20, 1));
    expect(codec.encodeResistMode(ResistMode.NONE)).toEqual(Uint8Array.of(0x20, 0));
    expect(codec.encodeResistMode(ResistMode.BRAKE)).toEqual(Uint8Array.of(0x20, 2));
    expect(() => codec.encodeResistMode(3)).toThrow(RangeError);
    expect(() => codec.encodeResistMode(-1)).toThrow(RangeError);
  });

  it("encodes a zone as the 15-byte layout the firmware reads", () => {
    const frame = codec.encodeResistZone({ index: 2, startDeg: 90, endDeg: 180, valuePercent: 25, edgeDeg: 10 });
    expect(Array.from(frame)).toEqual([0x21, 2, ...f32(90), ...f32(180), 0, ...f32(25), 10]);
    expect(frame).toHaveLength(16); // opcode + 15 payload bytes
  });

  it("uses a 15° edge when none is given", () => {
    const frame = codec.encodeResistZone({ index: 0, startDeg: 0, endDeg: 360, valuePercent: 100 });
    expect(frame[15]).toBe(15);
  });

  it("accepts a zone that wraps through 0° and a full turn", () => {
    expect(() => codec.encodeResistZone({ index: 0, startDeg: 300, endDeg: 40, valuePercent: 0 })).not.toThrow();
    expect(() => codec.encodeResistZone({ index: 0, startDeg: 0, endDeg: 360, valuePercent: 0 })).not.toThrow();
  });

  it("refuses zones the board would refuse, before writing anything", () => {
    const base = { index: 0, startDeg: 90, endDeg: 180, valuePercent: 50 };
    expect(() => codec.encodeResistZone({ ...base, index: 8 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, index: -1 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, index: 1.5 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, startDeg: -1 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, endDeg: 361 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, startDeg: NaN })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, endDeg: 90 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, endDeg: 90.5 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, valuePercent: 101 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, valuePercent: -1 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, edgeDeg: 61 })).toThrow(RangeError);
    expect(() => codec.encodeResistZone({ ...base, edgeDeg: 2.5 })).toThrow(RangeError);
  });

  it("encodes the no-payload commands as a single byte", () => {
    expect(codec.encodeResistCommit()).toEqual(Uint8Array.of(0x22));
    expect(codec.encodeResistClear()).toEqual(Uint8Array.of(0x23));
    expect(codec.encodeResistGet()).toEqual(Uint8Array.of(0x26));
    expect(codec.encodeHoldRelease()).toEqual(Uint8Array.of(0x25));
  });

  it("encodes the holding current as a float32 and limits its range", () => {
    expect(Array.from(codec.encodeHoldEngage(1.5))).toEqual([0x24, ...f32(1.5)]);
    expect(() => codec.encodeHoldEngage(0)).toThrow(RangeError);
    expect(() => codec.encodeHoldEngage(-1)).toThrow(RangeError);
    expect(() => codec.encodeHoldEngage(HOLD_MAX_CURRENT_A + 0.1)).toThrow(RangeError);
    expect(() => codec.encodeHoldEngage(NaN)).toThrow(RangeError);
    expect(() => codec.encodeHoldEngage(HOLD_MAX_CURRENT_A)).not.toThrow();
  });

  it("encodes the gains as four float32 in the firmware's order", () => {
    const frame = codec.encodeResistTune({ kpSpeed: 0.0003, kiSpeed: 0.001, kpPos: 0.02, kdPos: 0.002 });
    expect(Array.from(frame)).toEqual([0x27, ...f32(0.0003), ...f32(0.001), ...f32(0.02), ...f32(0.002)]);
    expect(() => codec.encodeResistTune({ kpSpeed: -1, kiSpeed: 0, kpPos: 0, kdPos: 0 })).toThrow(RangeError);
    expect(() => codec.encodeResistTune({ kpSpeed: NaN, kiSpeed: 0, kpPos: 0, kdPos: 0 })).toThrow(RangeError);
  });
});

describe("physiotherapy decoders", () => {
  it("decodes a resistance frame", () => {
    const frame = new Uint8Array(20);
    const view = new DataView(frame.buffer);
    frame[0] = 0x29;
    view.setUint32(1, 123456, true);
    view.setFloat32(5, -0.75, true);
    view.setFloat32(9, 0.5, true);
    frame[13] = 3;
    frame[14] = 3;
    frame[15] = 0x03;
    view.setFloat32(16, 87.5, true);
    expect(codec.decode(frame)).toEqual({
      kind: "resistance",
      resistance: {
        timestampMs: 123456,
        commandedCurrent: -0.75,
        assistFactor: 0.5,
        mode: 3,
        phase: 3,
        limitFlags: 3,
        thermalPercent: 87.5,
      },
    });
  });

  it("does not take a short 0x29 frame for a resistance frame", () => {
    expect(codec.decode(new Uint8Array(19).fill(0).map((_, i) => (i === 0 ? 0x29 : 0))).kind).toBe("unrecognized");
  });

  it("decodes a zone reply and the 'no zones' reply", () => {
    const frame = new Uint8Array(17);
    const view = new DataView(frame.buffer);
    frame[0] = 0x26;
    frame[1] = 1;
    frame[2] = 2;
    view.setFloat32(3, 90, true);
    view.setFloat32(7, 180, true);
    frame[11] = 0;
    view.setFloat32(12, 25, true);
    frame[16] = 15;
    expect(codec.decode(frame)).toEqual({
      kind: "resistZone",
      total: 2,
      zone: { index: 1, startDeg: 90, endDeg: 180, type: 0, valuePercent: 25, edgeDeg: 15 },
    });
    expect(codec.decode(Uint8Array.of(0x26, 0xff, 0))).toEqual({ kind: "resistZone", zone: null, total: 0 });
  });

  it("decodes the new NACK reason like any other", () => {
    expect(codec.decode(Uint8Array.of(0x1f, 0x20, 5))).toEqual({ kind: "nack", rejectedOpcode: 0x20, reason: 5 });
  });
});
