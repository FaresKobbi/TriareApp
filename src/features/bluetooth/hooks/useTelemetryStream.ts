import { useEffect, useState } from "react";
import { TelemetryData } from "../protocol/TriareFrames";
import { BleSession } from "../services/BleSession";

/** After the board accepts the stream, how long to wait for the first frame. */
const FIRST_FRAME_TIMEOUT_MS = 1500;

/**
 * Live telemetry pushed by the board (20 Hz) while `enabled`.
 *
 * Compared with polling it needs no request per sample (half the radio
 * traffic) and every sample carries the board's own timestamp, which the pedal
 * dial uses to estimate the crank speed. While enabled it also asks for the
 * low-latency BLE link, and gives it back when disabled or unmounted.
 *
 * `supported` tells the caller whether streaming works on this board:
 * `null` while still finding out, `true` once frames arrive, `false` when the
 * firmware does not know the command (or accepted it but sent nothing). The
 * caller should then fall back to `useTelemetryPolling`.
 */
export function useTelemetryStream(session: BleSession | null, enabled: boolean) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session || !enabled) return;

    let cancelled = false;
    let gotFrame = false;
    let stop: (() => void) | null = null;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    setSupported(null);

    void session.setFastLink(true);
    session.commands
      .startStream((sample) => {
        if (cancelled) return;
        gotFrame = true;
        if (watchdog) clearTimeout(watchdog);
        setSupported(true);
        setTelemetry(sample);
      })
      .then((stopStream) => {
        if (cancelled) {
          stopStream();
          return;
        }
        stop = stopStream;
        // Accepted but silent (e.g. a frame that does not fit the link's MTU):
        // let the caller poll instead.
        if (!gotFrame) {
          watchdog = setTimeout(() => {
            if (!cancelled && !gotFrame) setSupported(false);
          }, FIRST_FRAME_TIMEOUT_MS);
        }
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      stop?.();
      void session.setFastLink(false);
    };
  }, [session, enabled]);

  // A stale answer must not outlive the switch: report "unknown" while off.
  return { telemetry, supported: enabled ? supported : null };
}
