import {
  NackReason,
  TriareOpcode,
  ZeroInfoFlag,
  ZeroSearchState,
} from "@/src/features/bluetooth/constants/triareProtocol";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { CommandRejectedError, TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";

const codec = new TriareVescCodec();
let manager: MockBleCharacteristicManager;
let service: TriareCommandService;

beforeEach(() => {
  manager = new MockBleCharacteristicManager();
  service = new TriareCommandService(manager, codec);
});

afterEach(() => service.dispose());

async function rejection(promise: Promise<unknown>): Promise<CommandRejectedError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(CommandRejectedError);
    return e as CommandRejectedError;
  }
  throw new Error("expected the command to be rejected");
}

/** Ratio sent, index learned by hand: what the board needs before it can search. */
async function commission() {
  await service.setGearRatio(76.36);
  await service.calibrateCrank();
  manager.fireZeroSensor(123.5);
}

describe("zero codec", () => {
  it("matches the firmware opcodes", () => {
    expect(TriareOpcode.ZERO_SEARCH).toBe(0x28);
    expect(TriareOpcode.ZERO_GET).toBe(0x2a);
    expect(NackReason.ZERO_SETUP).toBe(6);
  });

  it("encodes start and cancel as one byte", () => {
    expect(codec.encodeZeroSearch(true)).toEqual(Uint8Array.of(0x28, 1));
    expect(codec.encodeZeroSearch(false)).toEqual(Uint8Array.of(0x28, 0));
    expect(codec.encodeZeroGet()).toEqual(Uint8Array.of(0x2a));
  });

  it("decodes the 15-byte ZERO_GET reply", () => {
    const frame = new Uint8Array(15);
    const view = new DataView(frame.buffer);
    frame[0] = 0x2a;
    frame[1] = ZeroInfoFlag.INDEX_KNOWN | ZeroInfoFlag.VALID | ZeroInfoFlag.RATIO_SET;
    frame[2] = ZeroSearchState.FOUND;
    view.setFloat32(3, 123.5, true);
    view.setFloat32(7, -1.25, true);
    view.setUint16(11, 7, true);
    view.setUint16(13, 2, true);
    expect(codec.decode(frame)).toEqual({
      kind: "zero",
      zero: {
        flags: 0x13,
        searchState: ZeroSearchState.FOUND,
        indexAngleDeg: 123.5,
        lastDriftDeg: -1.25,
        pulses: 7,
        slips: 2,
      },
    });
  });

  it("does not take a short ZERO_GET reply for a real one", () => {
    expect(codec.decode(Uint8Array.of(0x2a, 1, 2, 3)).kind).toBe("unrecognized");
  });
});

describe("zero over the service", () => {
  it("reads the state of a board with nothing set up", async () => {
    const info = await service.getZeroInfo();
    expect(info).toMatchObject({ flags: 0, searchState: ZeroSearchState.NONE, pulses: 0, slips: 0 });
  });

  it("refuses to search while disarmed (NOT_ARMED)", async () => {
    await commission();
    const e = await rejection(service.startZeroSearch());
    expect(e.reason).toBe(NackReason.NOT_ARMED);
  });

  it("refuses to search before a ratio and a learned index (ZERO_SETUP)", async () => {
    await service.enable();
    expect((await rejection(service.startZeroSearch())).reason).toBe(NackReason.ZERO_SETUP);
    await service.setGearRatio(76.36);
    expect((await rejection(service.startZeroSearch())).reason).toBe(NackReason.ZERO_SETUP);
  });

  it("learns the index only when the ratio was sent first (the ACK is the same either way)", async () => {
    await service.calibrateCrank();
    expect((await service.getZeroInfo()).flags & ZeroInfoFlag.LEARNING).toBe(0);

    await service.setGearRatio(76.36);
    await service.calibrateCrank();
    expect((await service.getZeroInfo()).flags & ZeroInfoFlag.LEARNING).not.toBe(0);

    manager.fireZeroSensor(90);
    const info = await service.getZeroInfo();
    expect(info.flags & ZeroInfoFlag.INDEX_KNOWN).not.toBe(0);
    expect(info.flags & ZeroInfoFlag.LEARNING).toBe(0);
    expect(info.indexAngleDeg).toBe(90);
  });

  it("searches, and reports FOUND when the sensor fires", async () => {
    await commission();
    await service.enable();
    await service.startZeroSearch();
    let info = await service.getZeroInfo();
    expect(info.flags & ZeroInfoFlag.SEARCHING).not.toBe(0);
    expect(info.searchState).toBe(ZeroSearchState.RUNNING);

    manager.fireZeroSensor(123.5);
    info = await service.getZeroInfo();
    expect(info.flags & ZeroInfoFlag.SEARCHING).toBe(0);
    expect(info.flags & ZeroInfoFlag.VALID).not.toBe(0);
    expect(info.searchState).toBe(ZeroSearchState.FOUND);
  });

  it("cancels a search in progress", async () => {
    await commission();
    await service.enable();
    await service.startZeroSearch();
    await service.cancelZeroSearch();
    const info = await service.getZeroInfo();
    expect(info.flags & ZeroInfoFlag.SEARCHING).toBe(0);
    expect(info.searchState).toBe(ZeroSearchState.ABORTED);
    expect(Array.from(manager.receivedFrames[manager.receivedFrames.length - 2])).toEqual([0x28, 0]);
  });

  it("reports when the board measured the reverse index", async () => {
    expect((await service.getZeroInfo()).flags & ZeroInfoFlag.REV_KNOWN).toBe(0);
    manager.zeroRevKnown = true;
    expect((await service.getZeroInfo()).flags & ZeroInfoFlag.REV_KNOWN).not.toBe(0);
    // a new ratio throws the measurement away
    await service.setGearRatio(76.36);
    expect((await service.getZeroInfo()).flags & ZeroInfoFlag.REV_KNOWN).toBe(0);
  });

  it("disarming ends the search", async () => {
    await commission();
    await service.enable();
    await service.startZeroSearch();
    await service.disable();
    expect((await service.getZeroInfo()).searchState).toBe(ZeroSearchState.ABORTED);
  });

  it("times out like the other commands on firmware without the zero search", async () => {
    jest.useFakeTimers();
    manager.supportsZero = false;
    const pending = service.getZeroInfo();
    const settled = pending.then(
      () => "answered",
      (e: Error) => e.name,
    );
    await jest.advanceTimersByTimeAsync(20000);
    expect(await settled).toBe("AckTimeoutError");
    jest.useRealTimers();
  });
});
