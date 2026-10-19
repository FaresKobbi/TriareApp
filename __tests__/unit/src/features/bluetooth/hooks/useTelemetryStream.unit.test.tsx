import { MockBleCharacteristicManager } from "@/src/features/bluetooth/mock/MockBleCharacteristicManager";
import { useTelemetryStream } from "@/src/features/bluetooth/hooks/useTelemetryStream";
import { TriareVescCodec } from "@/src/features/bluetooth/protocol/TriareVescCodec";
import { BleSession } from "@/src/features/bluetooth/services/BleSession";
import { TriareCommandService } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create } from "react-test-renderer";

function renderHook<T, P>(hookFn: (props: P) => T, initialProps: P) {
  const result: { current: T | null } = { current: null };
  function TestComponent({ props }: { props: P }) {
    result.current = hookFn(props);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(React.createElement(TestComponent, { props: initialProps }));
  });
  return {
    result,
    rerender: (props: P) =>
      act(() => {
        renderer.update(React.createElement(TestComponent, { props }));
      }),
    unmount: () =>
      act(() => {
        renderer.unmount();
      }),
  };
}

const SAMPLE = { rpm: 800, current: 2, voltage: 36, temp: 30, crankAngleDeg: 90, fault: 0 };

function createSession(firmware: MockBleCharacteristicManager, ackTimeoutMs = 50) {
  const setFastLink = jest.fn().mockResolvedValue(undefined);
  const session = {
    commands: new TriareCommandService(firmware, new TriareVescCodec(), ackTimeoutMs),
    setFastLink,
  } as unknown as BleSession;
  return { session, setFastLink };
}

/** Lets pending promise callbacks (mock notifications, ACKs) run. */
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("useTelemetryStream", () => {
  it("does nothing while disabled", async () => {
    const firmware = new MockBleCharacteristicManager();
    const { session, setFastLink } = createSession(firmware);
    const { result } = renderHook(({ on }: { on: boolean }) => useTelemetryStream(session, on), { on: false });
    await flush();

    expect(result.current!.supported).toBeNull();
    expect(firmware.receivedFrames).toHaveLength(0);
    expect(setFastLink).not.toHaveBeenCalled();
  });

  it("starts the stream, exposes pushed samples and asks for the fast link", async () => {
    const firmware = new MockBleCharacteristicManager();
    const { session, setFastLink } = createSession(firmware);
    const { result, unmount } = renderHook(
      ({ on }: { on: boolean }) => useTelemetryStream(session, on),
      { on: true },
    );
    await flush();
    expect(firmware.streaming).toBe(true);
    expect(setFastLink).toHaveBeenCalledWith(true);

    await act(async () => {
      firmware.emitStreamFrame(SAMPLE, 1000, 0x01);
      await Promise.resolve();
    });

    expect(result.current!.supported).toBe(true);
    expect(result.current!.telemetry).toMatchObject({ ...SAMPLE, timestampMs: 1000, status: 0x01 });

    unmount();
    await flush();
    expect(firmware.streaming).toBe(false);
    expect(setFastLink).toHaveBeenLastCalledWith(false);
  });

  it("gives the fast link back and stops the stream when switched off", async () => {
    const firmware = new MockBleCharacteristicManager();
    const { session, setFastLink } = createSession(firmware);
    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) => useTelemetryStream(session, on),
      { on: true },
    );
    await flush();
    await act(async () => {
      firmware.emitStreamFrame(SAMPLE, 1000);
      await Promise.resolve();
    });
    expect(result.current!.supported).toBe(true);

    rerender({ on: false });
    await flush();

    expect(firmware.streaming).toBe(false);
    expect(setFastLink).toHaveBeenLastCalledWith(false);
    expect(result.current!.supported).toBeNull();
  });

  it("reports supported=false on firmware that ignores CMD_STREAM (caller falls back to polling)", async () => {
    const firmware = new MockBleCharacteristicManager();
    firmware.supportsStream = false;
    const { session } = createSession(firmware, 30);
    const { result } = renderHook(
      ({ on }: { on: boolean }) => useTelemetryStream(session, on),
      { on: true },
    );

    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });

    expect(result.current!.supported).toBe(false);
    expect(result.current!.telemetry).toBeNull();
  });

  it("reports supported=false when the stream is accepted but no frame ever arrives", async () => {
    jest.useFakeTimers();
    try {
      const firmware = new MockBleCharacteristicManager();
      const { session } = createSession(firmware);
      const { result } = renderHook(
        ({ on }: { on: boolean }) => useTelemetryStream(session, on),
        { on: true },
      );
      await act(async () => { await jest.advanceTimersByTimeAsync(10); });
      expect(result.current!.supported).toBeNull();

      await act(async () => { await jest.advanceTimersByTimeAsync(1600); });
      expect(result.current!.supported).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
