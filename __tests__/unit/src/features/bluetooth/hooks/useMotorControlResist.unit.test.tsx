import { ResistMode, TelemetryStatus } from "@/src/features/bluetooth/constants/triareProtocol";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create } from "react-test-renderer";

/** Minimal renderHook helper using react-test-renderer (same as useMotorControl.unit.test). */
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

function createMockSession(firmware: MockBleCharacteristicManager): BleSession {
  return { commands: new TriareCommandService(firmware, new TriareVescCodec()) } as BleSession;
}

const zone = { index: 0, startDeg: 60, endDeg: 150, valuePercent: 0 };

describe("useMotorControl — physiotherapy modes", () => {
  it("keeps the resistance samples the board pushes", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    expect(result.current!.resistance).toBeNull();

    await act(async () => {
      firmware.emitResistFrame({
        timestampMs: 1, commandedCurrent: 0.25, assistFactor: 0.5, mode: 1, phase: 1, limitFlags: 0, thermalPercent: 10,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current!.resistance).toMatchObject({ commandedCurrent: 0.25, assistFactor: 0.5, mode: 1 });
  });

  it("remembers the last status byte it was given", () => {
    const { result } = renderHook(() => useMotorControl(null));
    expect(result.current!.boardStatus).toBeNull();
    act(() => {
      result.current!.observeStatus(TelemetryStatus.ARMED | TelemetryStatus.RESISTANCE);
    });
    expect(result.current!.boardStatus).toBe(0x09);
  });

  it("explains instead of sending when the system is known to be disarmed", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    await act(async () => {
      await result.current!.disable();
    });
    firmware.receivedFrames.length = 0;

    await act(async () => {
      await result.current!.setResistMode(ResistMode.ASSIST_VALLEY);
    });
    expect(result.current!.feedback?.title).toBe("System is disarmed");
    expect(firmware.receivedFrames).toHaveLength(0);
  });

  it("sends zones, starts the mode and marks the system as running", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    await act(async () => {
      await result.current!.enable();
      await result.current!.applyResistZones([zone, { ...zone, index: 1, startDeg: 200, endDeg: 250 }]);
    });
    expect(result.current!.feedback?.title).toBe("2 zones sent");
    expect(firmware.activeZones).toHaveLength(2);

    await act(async () => {
      await result.current!.setResistMode(ResistMode.ASSIST_VALLEY);
    });
    expect(firmware.resistMode).toBe(ResistMode.ASSIST_VALLEY);
    expect(result.current!.systemState).toBe("running");

    await act(async () => {
      await result.current!.setResistMode(ResistMode.NONE);
    });
    expect(result.current!.systemState).toBe("armed");
  });

  it("says the brake is not available", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    await act(async () => {
      await result.current!.enable();
      await result.current!.setResistMode(ResistMode.BRAKE);
    });
    expect(result.current!.feedback?.title).toBe("Brake is not available");
    expect(firmware.resistMode).toBe(ResistMode.NONE);
    expect(result.current!.systemState).toBe("armed");
  });

  it("explains a hold refused for a low gear ratio, then holds and releases", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    await act(async () => {
      await result.current!.enable();
      await result.current!.engageHold(1);
    });
    expect(result.current!.feedback?.detail).toMatch(/gear ratio of 3 or more/);
    expect(firmware.resistMode).toBe(ResistMode.NONE);

    await act(async () => {
      await result.current!.setGearRatio(10);
      await result.current!.engageHold(1.25);
    });
    expect(firmware.holdCurrentA).toBeCloseTo(1.25);
    expect(result.current!.systemState).toBe("running");

    await act(async () => {
      await result.current!.releaseHold();
    });
    expect(firmware.resistMode).toBe(ResistMode.NONE);
    expect(result.current!.systemState).toBe("armed");
  });

  it("reads the zones back", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    let zones: unknown = null;
    await act(async () => {
      await result.current!.applyResistZones([zone]);
      zones = await result.current!.readResistZones();
    });
    expect(zones).toHaveLength(1);
  });

  it("reports a local range error as a message, without writing", async () => {
    const firmware = new MockBleCharacteristicManager();
    const session = createMockSession(firmware);
    const { result } = renderHook(() => useMotorControl(session));
    await act(async () => {
      await result.current!.enable();
    });
    firmware.receivedFrames.length = 0;
    await act(async () => {
      await result.current!.engageHold(9);
    });
    expect(result.current!.feedback?.title).toBe("Invalid value");
    expect(firmware.receivedFrames).toHaveLength(0);
  });
});
