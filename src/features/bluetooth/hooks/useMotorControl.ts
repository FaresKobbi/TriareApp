import { useCallback, useEffect, useState } from "react";
import { TelemetryData } from "../protocol/TriareFrames";
import { BleSession } from "../services/BleSession";
import { TriareCommandService } from "../services/TriareCommandService";

/**
 * Typed motor-control surface for UI screens.
 *
 * Wraps the active session's `TriareCommandService` with busy/error state so
 * a screen can wire buttons straight to `enable()`, `setRpm()`, etc. Errors —
 * including the ACK timeout, which means a command's outcome is unknown — are
 * surfaced through `error`, consistent with the other BLE hooks.
 *
 * Note: `stop()` freewheels the motor and leaves the system armed; `disable()`
 * disarms it. Neither is an active brake — see BLE_PROTOCOL.md, "Known gaps".
 */
export function useMotorControl(session: BleSession | null) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new (or lost) session invalidates everything read from the old one.
  useEffect(() => {
    setTelemetry(null);
    setError(null);
  }, [session]);

  const run = useCallback(
    async <T,>(operation: (commands: TriareCommandService) => Promise<T>): Promise<T | null> => {
      if (!session) {
        setError("Not connected");
        return null;
      }
      setIsBusy(true);
      setError(null);
      try {
        return await operation(session.commands);
      } catch (e) {
        setError(e instanceof Error ? e.message : "BLE command failed");
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [session],
  );

  /** Arms the system; motor stays freewheeling until a setpoint is sent. */
  const enable = useCallback(() => run((c) => c.enable()), [run]);

  /** Disarms the system. */
  const disable = useCallback(() => run((c) => c.disable()), [run]);

  /** Freewheels the motor; system stays armed. */
  const stop = useCallback(() => run((c) => c.stop()), [run]);

  /** Sets the target electrical RPM (requires an enabled system). */
  const setRpm = useCallback((erpm: number) => run((c) => c.setRpm(erpm)), [run]);

  /** Sets the duty cycle in [-1.0, 1.0]; negative reverses the motor. */
  const setDuty = useCallback((duty: number) => run((c) => c.setDuty(duty)), [run]);

  /** Zeroes the crank angle at the current pedal position. */
  const calibrateCrank = useCallback(() => run((c) => c.calibrateCrank()), [run]);

  /** Sets the gear ratio (crank teeth ÷ motor teeth); also re-zeroes the crank angle. */
  const setGearRatio = useCallback((ratio: number) => run((c) => c.setGearRatio(ratio)), [run]);


  /** Fetches one telemetry sample and stores it in `telemetry`. */
  const requestTelemetry = useCallback(
    () =>
      run(async (c) => {
        const data = await c.requestTelemetry();
        setTelemetry(data);
        return data;
      }),
    [run],
  );

  return {
    enable,
    disable,
    stop,
    setRpm,
    setDuty,
    calibrateCrank,
    setGearRatio,
    requestTelemetry,
    /** Last telemetry sample of this session, or null. */
    telemetry,
    /** True while a command round-trip is in flight. */
    isBusy,
    /** Last command error (including ACK timeouts), cleared on the next command. */
    error,
    isConnected: session != null,
  };
}
