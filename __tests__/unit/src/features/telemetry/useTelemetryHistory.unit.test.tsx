import { TelemetryData } from "@/src/features/bluetooth/protocol/TriareFrames";
import { CHART_REFRESH_MS, useTelemetryHistory } from "@/src/features/telemetry/useTelemetryHistory";
import { useThrottledValue } from "@/src/features/telemetry/useThrottledValue";
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
    unmount: () => act(() => renderer.unmount()),
  };
}

const s = (rpm: number): TelemetryData => ({
  rpm,
  current: 1,
  voltage: 25,
  temp: 30,
  crankAngleDeg: 0,
  fault: 0,
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useTelemetryHistory", () => {
  it("stores each new sample once, even if the component re-renders", () => {
    type P = { sample: TelemetryData | null; active: boolean };
    const a = s(100);
    const { result, rerender } = renderHook(
      ({ sample, active }: P) => useTelemetryHistory(sample, active),
      { sample: a, active: true } as P,
    );
    expect(result.current!.history.length).toBe(1);

    rerender({ sample: a, active: true }); // same object: no duplicate
    expect(result.current!.history.length).toBe(1);

    rerender({ sample: s(200), active: true });
    expect(result.current!.history.length).toBe(2);
    expect(result.current!.history.latest()?.erpm).toBe(200);
  });

  it("ticks the version only while active", () => {
    type P = { sample: TelemetryData | null; active: boolean };
    const { result, rerender } = renderHook(
      ({ sample, active }: P) => useTelemetryHistory(sample, active),
      { sample: null, active: true } as P,
    );
    expect(result.current!.version).toBe(0);
    act(() => {
      jest.advanceTimersByTime(CHART_REFRESH_MS * 3);
    });
    expect(result.current!.version).toBe(3);

    rerender({ sample: null, active: false });
    act(() => {
      jest.advanceTimersByTime(CHART_REFRESH_MS * 5);
    });
    expect(result.current!.version).toBe(3);
  });

  it("keeps the same history object across renders", () => {
    type P = { sample: TelemetryData | null; active: boolean };
    const { result, rerender } = renderHook(
      ({ sample, active }: P) => useTelemetryHistory(sample, active),
      { sample: null, active: false } as P,
    );
    const first = result.current!.history;
    rerender({ sample: s(1), active: false });
    expect(result.current!.history).toBe(first);
  });
});

describe("useThrottledValue", () => {
  it("passes the first value, limits the rate and never loses the last value", () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useThrottledValue(v, 200), { v: 1 });
    expect(result.current).toBe(1);

    jest.setSystemTime(Date.now() + 50);
    rerender({ v: 2 });
    rerender({ v: 3 });
    expect(result.current).toBe(1); // too soon

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe(3); // the last one arrives
  });
});
