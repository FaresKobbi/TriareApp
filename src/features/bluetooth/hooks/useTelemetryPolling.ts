import { useEffect, useRef, useState } from "react";
import { TelemetryData } from "../protocol/TriareFrames";

const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Polls telemetry while `enabled`.
 *
 * Uses a chain of `setTimeout` rather than `setInterval`: the next request is
 * only scheduled after the previous one settled, so requests never pile up
 * behind a slow BLE round-trip. After {@link MAX_CONSECUTIVE_FAILURES}
 * failures in a row it gives up and exposes the error; toggle `enabled` off
 * and on, or change `restartKey`, to resume.
 *
 * It deliberately does not go through `useMotorControl.requestTelemetry`,
 * which toggles `isBusy` on every call and would make the UI flicker at
 * polling rate.
 */
export function useTelemetryPolling(
  requestTelemetry: () => Promise<TelemetryData>,
  enabled: boolean,
  intervalMs = 150,
  restartKey = 0,
) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // True once it gave up after repeated failures (a single failed sample is
  // only an `error` that the next success clears).
  const [stopped, setStopped] = useState(false);

  // Always call the latest closure without restarting the polling loop.
  const requestRef = useRef(requestTelemetry);
  requestRef.current = requestTelemetry;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    setError(null);
    setStopped(false);

    const tick = async () => {
      try {
        const sample = await requestRef.current();
        if (cancelled) return;
        setTelemetry(sample);
        setError(null);
        failures = 0;
      } catch (e) {
        if (cancelled) return;
        failures += 1;
        setError(e instanceof Error ? e : new Error(String(e)));
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setStopped(true);
          return;
        }
      }
      timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs, restartKey]);

  return { telemetry, error, stopped };
}
