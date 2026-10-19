import { ACK_TIMEOUT_MS, ResistMode, TelemetryStatus } from "@/src/features/bluetooth/constants/triareProtocol";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import {
  AckTimeoutError,
  CommandRejectedError,
  TriareCommandService,
} from "@/src/features/bluetooth/services/TriareCommandService";

let manager: MockBleCharacteristicManager;
let service: TriareCommandService;

beforeEach(() => {
  manager = new MockBleCharacteristicManager();
  service = new TriareCommandService(manager, new TriareVescCodec());
});

afterEach(() => {
  service.dispose();
  jest.useRealTimers();
});

async function rejection(promise: Promise<unknown>): Promise<CommandRejectedError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(CommandRejectedError);
    return e as CommandRejectedError;
  }
  throw new Error("expected the command to be rejected");
}

describe("assist valley", () => {
  it("refuses to start while disarmed (NOT_ARMED)", async () => {
    const e = await rejection(service.setResistMode(ResistMode.ASSIST_VALLEY));
    expect(e.reason).toBe(1);
    expect(manager.resistMode).toBe(ResistMode.NONE);
  });

  it("starts and ends once armed", async () => {
    await service.enable();
    await service.setResistMode(ResistMode.ASSIST_VALLEY);
    expect(manager.resistMode).toBe(ResistMode.ASSIST_VALLEY);
    await service.setResistMode(ResistMode.NONE);
    expect(manager.resistMode).toBe(ResistMode.NONE);
  });

  it("refuses the brake (NO_REGEN_PATH) and leaves the mode alone", async () => {
    await service.enable();
    const e = await rejection(service.setResistMode(ResistMode.BRAKE));
    expect(e.reason).toBe(5);
    expect(manager.resistMode).toBe(ResistMode.NONE);
  });

  it("disarming ends the mode", async () => {
    await service.enable();
    await service.setResistMode(ResistMode.ASSIST_VALLEY);
    await service.disable();
    expect(manager.resistMode).toBe(ResistMode.NONE);
  });
});

describe("zones", () => {
  it("applyResistZones replaces the board's zones (clear, stage, commit)", async () => {
    await service.applyResistZones([
      { index: 0, startDeg: 60, endDeg: 150, valuePercent: 0 },
      { index: 1, startDeg: 300, endDeg: 20, valuePercent: 40, edgeDeg: 30 },
    ]);
    expect(manager.activeZones).toHaveLength(2);
    expect(manager.activeZones[1]).toEqual({
      index: 1, startDeg: 300, endDeg: 20, type: 0, valuePercent: 40, edgeDeg: 30,
    });

    await service.applyResistZones([{ index: 0, startDeg: 0, endDeg: 90, valuePercent: 10 }]);
    expect(manager.activeZones).toHaveLength(1);
    expect(manager.activeZones[0].endDeg).toBe(90);
  });

  it("only changes the active zones at the commit", async () => {
    await service.stageResistZone({ index: 0, startDeg: 10, endDeg: 50, valuePercent: 5 });
    expect(manager.stagedZones).toHaveLength(1);
    expect(manager.activeZones).toHaveLength(0);
    await service.commitResistZones();
    expect(manager.activeZones).toHaveLength(1);
    await service.clearResistZones();
    expect(manager.activeZones).toHaveLength(0);
    expect(manager.stagedZones).toHaveLength(0);
  });

  it("refuses an invalid zone locally, without writing", async () => {
    await expect(
      service.stageResistZone({ index: 0, startDeg: 10, endDeg: 10, valuePercent: 5 }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(manager.receivedFrames).toHaveLength(0);
  });

  it("reads the zones back, in index order", async () => {
    await service.applyResistZones([
      { index: 0, startDeg: 60, endDeg: 150, valuePercent: 0 },
      { index: 1, startDeg: 200, endDeg: 250, valuePercent: 30 },
      { index: 2, startDeg: 300, endDeg: 340, valuePercent: 60 },
    ]);
    const zones = await service.getResistZones();
    expect(zones.map((z) => z.index)).toEqual([0, 1, 2]);
    expect(zones[1]).toMatchObject({ startDeg: 200, endDeg: 250, valuePercent: 30, edgeDeg: 15 });
  });

  it("reads an empty list when the board has no zones", async () => {
    expect(await service.getResistZones()).toEqual([]);
  });

  it("times out when the board stops answering half-way through the list", async () => {
    jest.useFakeTimers();
    manager.respondToCommands = false;
    const promise = service.getResistZones();
    const assertion = expect(promise).rejects.toBeInstanceOf(AckTimeoutError);
    await jest.advanceTimersByTimeAsync(10);
    // Only the first of two zone frames arrives.
    const frame = new Uint8Array(17);
    frame[0] = 0x26;
    frame[1] = 0;
    frame[2] = 2;
    new DataView(frame.buffer).setFloat32(3, 60, true);
    new DataView(frame.buffer).setFloat32(7, 150, true);
    manager.emitRawFrame(frame);
    await jest.advanceTimersByTimeAsync(ACK_TIMEOUT_MS + 10);
    await assertion;
  });

  it("surfaces a timeout on firmware without the feature", async () => {
    jest.useFakeTimers();
    manager.supportsResistance = false;
    const promise = service.getResistZones();
    const assertion = expect(promise).rejects.toBeInstanceOf(AckTimeoutError);
    await jest.advanceTimersByTimeAsync(ACK_TIMEOUT_MS + 10);
    await assertion;
  });
});

describe("static hold", () => {
  it("needs the system armed", async () => {
    const e = await rejection(service.engageHold(1));
    expect(e.reason).toBe(1);
  });

  it("is refused with a low gear ratio (INVALID_VALUE) and accepted at 10", async () => {
    await service.enable();
    const e = await rejection(service.engageHold(1));
    expect(e.reason).toBe(4);
    await service.setGearRatio(10);
    await service.engageHold(1.5);
    expect(manager.resistMode).toBe(ResistMode.HOLD);
    expect(manager.holdCurrentA).toBeCloseTo(1.5);
  });

  it("releases", async () => {
    await service.enable();
    await service.setGearRatio(10);
    await service.engageHold(1);
    await service.releaseHold();
    expect(manager.resistMode).toBe(ResistMode.NONE);
    expect(manager.holdCurrentA).toBeNull();
  });

  it("refuses a current above the limit before writing", async () => {
    await expect(service.engageHold(5)).rejects.toBeInstanceOf(RangeError);
    expect(manager.receivedFrames).toHaveLength(0);
  });
});

describe("tuning", () => {
  it("sends the gains", async () => {
    await service.tuneResist({ kpSpeed: 0.0003, kiSpeed: 0.001, kpPos: 0.03, kdPos: 0.003 });
    expect(manager.resistGains?.[2]).toBeCloseTo(0.03);
  });
});

describe("resistance frames", () => {
  it("are delivered to listeners and never mistaken for a reply", async () => {
    const seen: number[] = [];
    const off = service.onResistance((s) => seen.push(s.commandedCurrent));

    // A frame arrives while a command is in flight: the command still gets its own ACK.
    const pending = service.enable();
    manager.emitResistFrame({
      timestampMs: 10, commandedCurrent: 0.5, assistFactor: 1, mode: 1, phase: 1, limitFlags: 0, thermalPercent: 3,
    });
    await pending;
    expect(manager.systemEnabled).toBe(true);
    expect(seen).toEqual([0.5]);

    off();
    manager.emitResistFrame({
      timestampMs: 20, commandedCurrent: 0.7, assistFactor: 1, mode: 1, phase: 1, limitFlags: 0, thermalPercent: 3,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([0.5]);
  });

  it("status bits for the new modes exist", () => {
    expect(TelemetryStatus.RESISTANCE).toBe(0x08);
    expect(TelemetryStatus.LIMITING).toBe(0x10);
  });
});
