import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create } from "react-test-renderer";

{/**
 * Minimal renderHook helper using react-test-renderer.
 * Avoids needing @testing-library/react-native as a dependency.
 */}
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

/** Session backed by the firmware simulator instead of a real Device. */
function createMockSession(firmware: MockBleCharacteristicManager): BleSession {
  return {
    commands: new TriareCommandService(firmware, new TriareVescCodec()),
  } as BleSession;
}

describe("useMotorControl", () => {
  it("reports not connected when there is no session", async () => {
    const { result } = renderHook(() => useMotorControl(null));

    expect(result.current!.isConnected).toBe(false);

    await act(async () => {
      await result.current!.enable();
    });

    expect(result.current!.error).toBe("Not connected");
  });

  it("drives the firmware through enable / setRpm / stop / disable", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));

    await act(async () => {
      await result.current!.enable();
      await result.current!.setRpm(800);
    });
    expect(firmware.systemEnabled).toBe(true);
    expect(firmware.lastTargetErpm).toBe(800);

    await act(async () => {
      await result.current!.stop();
      await result.current!.disable();
    });
    expect(firmware.lastTargetErpm).toBeNull();
    expect(firmware.systemEnabled).toBe(false);
    expect(result.current!.error).toBeNull();
  });

  it("stores the latest telemetry sample", async () => {
    const firmware = new MockBleCharacteristicManager();
    firmware.telemetry = { rpm: 750, current: 2.5, voltage: 36.5, temp: 39.25, fault: 0 };
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));

    await act(async () => {
      await result.current!.requestTelemetry();
    });

    expect(result.current!.telemetry).toEqual(firmware.telemetry);
  });

  it("surfaces the ACK timeout as an error", async () => {
    const firmware = new MockBleCharacteristicManager();
    firmware.respondToCommands = false;
    const session = {
      // Short timeout to keep the test fast.
      commands: new TriareCommandService(firmware, new TriareVescCodec(), 30),
    } as BleSession;
    const { result } = renderHook(() => useMotorControl(session));

    await act(async () => {
      await result.current!.enable();
    });

    expect(result.current!.error).toMatch(/No response for command 0x10/);
    expect(result.current!.isBusy).toBe(false);
  });

  it("clears a previous error when the next command succeeds", async () => {
    const firmware = new MockBleCharacteristicManager();
    firmware.respondToCommands = false;
    const session = {
      commands: new TriareCommandService(firmware, new TriareVescCodec(), 30),
    } as BleSession;
    const { result } = renderHook(() => useMotorControl(session));

    await act(async () => {
      await result.current!.enable();
    });
    expect(result.current!.error).not.toBeNull();

    firmware.respondToCommands = true;
    await act(async () => {
      await result.current!.enable();
    });
    expect(result.current!.error).toBeNull();
  });
});
