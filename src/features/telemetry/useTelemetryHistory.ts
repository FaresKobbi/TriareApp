import { useEffect, useRef, useState } from "react";
import { TelemetryData } from "../bluetooth/protocol/TriareFrames";
import { DEFAULT_HISTORY_CAPACITY, TelemetryHistory } from "./TelemetryHistory";

/** How often the charts redraw. The eye cannot use more and the battery can. */
export const CHART_REFRESH_MS = 250;

/**
 * Keeps a rolling history of the telemetry and a slow `version` counter.
 *
 * - Every new `sample` (by identity) goes into the buffer, without causing a
 *   render by itself.
 * - While `active`, `version` increases every {@link CHART_REFRESH_MS}; the
 *   charts depend on it, so they redraw at 4 Hz even if samples arrive at
 *   20 Hz. When `active` is false the timer stops and nothing redraws.
 */
export function useTelemetryHistory(
  sample: TelemetryData | null,
  active: boolean,
  capacity = DEFAULT_HISTORY_CAPACITY,
) {
  const historyRef = useRef<TelemetryHistory | null>(null);
  if (historyRef.current === null) historyRef.current = new TelemetryHistory(capacity);
  const history = historyRef.current;

  const lastPushed = useRef<TelemetryData | null>(null);
  useEffect(() => {
    if (!sample || sample === lastPushed.current) return;
    lastPushed.current = sample;
    history.push(sample);
  }, [sample, history]);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setVersion((v) => v + 1), CHART_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active]);

  return { history, version };
}
