import { TelemetryStatus, TriareOpcode, ZeroInfoFlag, ZeroSearchState } from "@/src/features/bluetooth/constants/triareProtocol";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import { usePedalZero, ZERO_POLL_MS } from "@/src/features/bluetooth/hooks/usePedalZero";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create } from "react-test-renderer";

/** The motor hook and the zero hook together, wired as the resistance screen does. */
function useBoth(session: BleSession | null, enabled: boolean) {
  const motor = useMotorControl(session);
  const zero = usePedalZero(motor, enabled);
  return { motor, zero };
}

function renderHook<T>(hookFn: () => T) {
  const result: { current: T | null } = { current: null };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });
  return {
    result,
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

let firmware: MockBleCharacteristicManager;
let session: BleSession;
const opcodes = () => firmware.receivedFrames.map((f) => f[0]);

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  firmware = new MockBleCharacteristicManager();
  session = { commands: new TriareCommandService(firmware, new TriareVescCodec()) } as BleSession;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("usePedalZero", () => {
  it("reads the sensor state when it is switched on, and not before", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, false));
    await flush();
    expect(opcodes()).not.toContain(0x2a);
    unmount();

    const on = renderHook(() => useBoth(session, true));
    await flush();
    expect(opcodes()).toContain(0x2a);
    expect(on.result.current!.zero.info).toMatchObject({ flags: 0, searchState: ZeroSearchState.NONE });
    expect(on.result.current!.zero.valid).toBe(false);
    on.unmount();
    void result;
  });

  it("tells the user to send the ratio instead of learning without one", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    firmware.receivedFrames.length = 0;

    let started = true;
    await act(async () => {
      started = await result.current!.zero.learnByHand();
    });
    expect(started).toBe(false);
    expect(result.current!.zero.problem).toBe("noRatio");
    expect(opcodes()).not.toContain(0x17); // CALIBRATE_CRANK was not sent
    unmount();
  });

  it("learns by hand once the ratio is set, and shows the wait", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    await act(async () => {
      await result.current!.motor.setGearRatio(76.36);
    });
    await act(async () => {
      expect(await result.current!.zero.learnByHand()).toBe(true);
    });
    expect(result.current!.zero.problem).toBeNull();
    expect(result.current!.zero.learning).toBe(true);

    firmware.fireZeroSensor(90);
    await act(async () => {
      await result.current!.zero.refresh();
    });
    expect(result.current!.zero.learning).toBe(false);
    expect(result.current!.zero.info!.flags & ZeroInfoFlag.INDEX_KNOWN).not.toBe(0);
    unmount();
  });

  it("does not start the motor without a learned index", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    await act(async () => {
      await result.current!.motor.setGearRatio(76.36);
    });
    firmware.receivedFrames.length = 0;
    await act(async () => {
      expect(await result.current!.zero.searchWithMotor()).toBe(false);
    });
    expect(result.current!.zero.problem).toBe("noIndex");
    expect(opcodes()).not.toContain(0x28);
    unmount();
  });

  it("arms a disarmed board, starts the search and follows it to FOUND", async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    await act(async () => {
      await result.current!.motor.setGearRatio(76.36);
      await result.current!.motor.calibrateCrank();
    });
    firmware.fireZeroSensor(123.5);
    await act(async () => {
      await result.current!.motor.disable();
    });
    expect(result.current!.motor.systemState).toBe("disarmed");
    firmware.receivedFrames.length = 0;

    await act(async () => {
      expect(await result.current!.zero.searchWithMotor()).toBe(true);
    });
    // enable → search, in that order
    expect(opcodes().filter((op) => op === TriareOpcode.SYSTEM_ENABLE || op === TriareOpcode.ZERO_SEARCH)).toEqual([
      TriareOpcode.SYSTEM_ENABLE,
      TriareOpcode.ZERO_SEARCH,
    ]);
    expect(firmware.zeroSearching).toBe(true);
    expect(result.current!.zero.searching).toBe(true);

    // The sensor fires: the next poll shows the result.
    firmware.fireZeroSensor(123.5);
    await act(async () => {
      jest.advanceTimersByTime(ZERO_POLL_MS);
    });
    await flush();
    expect(result.current!.zero.searching).toBe(false);
    expect(result.current!.zero.valid).toBe(true);
    expect(result.current!.zero.info!.searchState).toBe(ZeroSearchState.FOUND);
    unmount();
  });

  it("uses the status byte for valid when the board reports it", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    act(() => {
      result.current!.motor.observeStatus(TelemetryStatus.ARMED | TelemetryStatus.ZERO_VALID);
    });
    expect(result.current!.zero.valid).toBe(true);
    act(() => {
      result.current!.motor.observeStatus(TelemetryStatus.ARMED);
    });
    expect(result.current!.zero.valid).toBe(false);
    unmount();
  });

  it("cancels the search", async () => {
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    await act(async () => {
      await result.current!.motor.setGearRatio(76.36);
      await result.current!.motor.calibrateCrank();
    });
    firmware.fireZeroSensor(10);
    await act(async () => {
      await result.current!.motor.enable();
      await result.current!.zero.searchWithMotor();
    });
    expect(firmware.zeroSearching).toBe(true);
    await act(async () => {
      await result.current!.zero.cancel();
    });
    expect(firmware.zeroSearching).toBe(false);
    expect(result.current!.zero.searching).toBe(false);
    expect(result.current!.zero.info!.searchState).toBe(ZeroSearchState.ABORTED);
    unmount();
  });

  it("warns when a search runs much longer than the board allows", async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() => useBoth(session, true));
    await flush();
    await act(async () => {
      await result.current!.motor.setGearRatio(76.36);
      await result.current!.motor.calibrateCrank();
    });
    firmware.fireZeroSensor(10);
    await act(async () => {
      await result.current!.motor.enable();
      await result.current!.zero.searchWithMotor();
    });
    expect(result.current!.zero.slow).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(21000);
    });
    await flush();
    expect(result.current!.zero.slow).toBe(true);
    unmount();
  });
});
