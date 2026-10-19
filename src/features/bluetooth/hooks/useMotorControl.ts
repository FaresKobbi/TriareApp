import { t, tp } from "@/src/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResistMode, TelemetryStatus } from "../constants/triareProtocol";
import { ResistGains, ResistZoneInput } from "../protocol/CommandCodec";
import { ResistanceData, ResistZone, TelemetryData } from "../protocol/TriareFrames";
import { BleSession } from "../services/BleSession";
import { TriareCommandService } from "../services/TriareCommandService";
import { erpmToMotorRpm } from "../utils/motorUnits";
import {
  blockedFeedback,
  CommandName,
  describeCommandError,
  Feedback,
  FeedbackContent,
  SystemState,
} from "../utils/commandFeedback";

type RunOptions = {
  /** Message shown when the command succeeds. Omit for no success toast. */
  success?: string;
  /** Refuse locally (with an explanation) while the system is known to be disarmed. */
  needsArmed?: boolean;
};

/**
 * Typed motor-control surface for UI screens.
 *
 * Wraps the active session's `TriareCommandService` with busy/error state so
 * a screen can wire buttons straight to `enable()`, `setRpm()`, etc. Errors —
 * including the ACK timeout, which means a command's outcome is unknown — are
 * surfaced through `error`, consistent with the other BLE hooks.
 *
 * On top of that it tracks what the board is known to be doing:
 * - `systemState`: unknown / disarmed / armed / running / emergency, learned
 *   from ACKs and NACKs and, in real time, from the status byte of the
 *   telemetry samples fed to `observeStatus`;
 * - `pending`: the command currently in flight, for per-button spinners;
 * - `feedback`: a user-facing message (success, refusal, timeout) for a toast.
 *
 * Note: `stop()` freewheels the motor and leaves the system armed; `disable()`
 * disarms it. Neither is an active brake — see BLE_PROTOCOL.md, "Known gaps".
 */
export function useMotorControl(session: BleSession | null) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemState, setSystemStateValue] = useState<SystemState>("unknown");
  const [pending, setPending] = useState<CommandName | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resistance, setResistance] = useState<ResistanceData | null>(null);
  const [boardStatus, setBoardStatus] = useState<number | null>(null);

  // Mirrors `systemState` so command callbacks read the latest value without
  // being re-created (and re-rendering consumers) on every state change.
  const stateRef = useRef<SystemState>("unknown");
  const feedbackId = useRef(0);
  // When our own Disable finished. A telemetry sample taken just before it can
  // still be delivered after it; that is not the board disarming itself.
  const lastDisableAt = useRef(0);

  const updateState = useCallback((next: SystemState) => {
    stateRef.current = next;
    setSystemStateValue(next);
  }, []);

  const notify = useCallback((content: FeedbackContent) => {
    feedbackId.current += 1;
    setFeedback({ ...content, id: feedbackId.current });
  }, []);

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  /**
   * Feeds the status byte of a polled telemetry sample, so a change made on
   * the board itself (the B3 emergency button, a fault) shows up without the
   * user having to send a command. Ignores samples from older firmware that
   * has no status byte.
   */
  const observeStatus = useCallback(
    (status: number | undefined) => {
      if (status === undefined) return;
      setBoardStatus((current) => (current === status ? current : status));
      const previous = stateRef.current;
      let next: SystemState;
      if ((status & TelemetryStatus.EMERGENCY) !== 0) {
        next = "emergency";
      } else if ((status & TelemetryStatus.ARMED) !== 0) {
        next = (status & TelemetryStatus.DRIVING) !== 0 ? "running" : "armed";
      } else {
        next = "disarmed";
      }
      if (next === previous) return;
      updateState(next);

      if (next === "emergency") {
        notify({
          tone: "error",
          title: t("motor.emergencyPressed"),
          detail: t("motor.emergencyPressedDetail"),
          action: "enable",
        });
      } else if (next === "disarmed" && previous === "emergency") {
        notify({
          tone: "info",
          title: t("motor.emergencyCleared"),
          detail: t("motor.emergencyClearedDetail"),
          action: "enable",
        });
      } else if (
        next === "disarmed" &&
        (previous === "armed" || previous === "running") &&
        Date.now() - lastDisableAt.current > 1500
      ) {
        // Our own Disable updates the state first, so this is the board's doing.
        notify({
          tone: "info",
          title: t("motor.selfDisarmed"),
          detail: t("motor.selfDisarmedDetail"),
          action: "enable",
        });
      }
    },
    [notify, updateState],
  );

  // The board announces state changes by itself (emergency button, fault, a
  // command from elsewhere): no polling needed. The first announcement comes
  // right after notifications are enabled, which settles "unknown" on connect.
  useEffect(() => {
    if (!session) return;
    return session.commands.onStatus((status) => observeStatus(status));
  }, [session, observeStatus]);

  // Resistance samples are pushed with the telemetry stream while a
  // physiotherapy mode is active; the last one stays until the session ends.
  useEffect(() => {
    if (!session) return;
    return session.commands.onResistance((sample) => setResistance(sample));
  }, [session]);

  // A new (or lost) session invalidates everything read from the old one.
  useEffect(() => {
    setTelemetry(null);
    setResistance(null);
    setBoardStatus(null);
    setError(null);
    setFeedback(null);
    setPending(null);
    updateState("unknown");
  }, [session, updateState]);

  const run = useCallback(
    async <T,>(
      name: CommandName,
      operation: (commands: TriareCommandService) => Promise<T>,
      options: RunOptions = {},
    ): Promise<T | null> => {
      if (!session) {
        setError(t("common.notConnected"));
        notify({ tone: "error", title: t("common.notConnected") });
        return null;
      }

      if (options.needsArmed) {
        const blocked = blockedFeedback(stateRef.current);
        if (blocked) {
          notify(blocked);
          return null;
        }
      }

      setIsBusy(true);
      setPending(name);
      setError(null);
      try {
        const result = await operation(session.commands);

        // Only some ACKs prove the arming state. STOP is acknowledged even
        // while disarmed, so it says nothing.
        if (name === "enable") {
          updateState("armed");
        } else if (name === "setRpm" || name === "setDuty") {
          updateState("running");
        } else if (name === "disable") {
          updateState("disarmed");
        } else if (name === "holdEngage" || (name === "resistMode" && result !== 0)) {
          updateState("running");
        } else if (name === "holdRelease" || (name === "resistMode" && result === 0)) {
          if (stateRef.current === "running") updateState("armed");
        } else if (name === "stop" && stateRef.current === "running") {
          updateState("armed");
        }
        if (options.success) {
          notify({ tone: "success", title: options.success });
        }
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : t("motor.commandFailed"));
        const outcome = describeCommandError(e, name);
        if (outcome.nextState) {
          updateState(outcome.nextState);
        }
        notify(outcome);
        return null;
      } finally {
        if (name === "disable") lastDisableAt.current = Date.now();
        setIsBusy(false);
        setPending(null);
      }
    },
    [session, notify, updateState],
  );

  /** Arms the system; motor stays freewheeling until a setpoint is sent. */
  const enable = useCallback(
    () => run("enable", (c) => c.enable(), { success: t("motor.armed") }),
    [run],
  );

  /** Disarms the system. */
  const disable = useCallback(
    () => run("disable", (c) => c.disable(), { success: t("motor.disarmed") }),
    [run],
  );

  /** Freewheels the motor; system stays armed. */
  const stop = useCallback(
    () => run("stop", (c) => c.stop(), { success: t("motor.released") }),
    [run],
  );

  /** Sets the target electrical RPM (requires an enabled system). */
  const setRpm = useCallback(
    (erpm: number) =>
      run("setRpm", (c) => c.setRpm(erpm), {
        // "500 RPM (2000 ERPM)": what the user typed first, what the firmware got second.
        success: t("motor.speedSent", {
          rpm: Number(erpmToMotorRpm(erpm).toFixed(1)),
          erpm: Math.round(erpm),
        }),
        needsArmed: true,
      }),
    [run],
  );

  /** Sets the duty cycle in [-1.0, 1.0]; negative reverses the motor. */
  const setDuty = useCallback(
    (duty: number) =>
      run("setDuty", (c) => c.setDuty(duty), {
        success: t("motor.dutySet", { duty: duty.toFixed(2) }),
        needsArmed: true,
      }),
    [run],
  );

  /** Zeroes the crank angle at the current pedal position. */
  const calibrateCrank = useCallback(
    () => run("calibrateCrank", (c) => c.calibrateCrank(), { success: t("motor.crankZeroed") }),
    [run],
  );

  /** Sets the gear ratio (crank teeth ÷ motor teeth); also re-zeroes the crank angle. */
  const setGearRatio = useCallback(
    (ratio: number) =>
      run("setGearRatio", (c) => c.setGearRatio(ratio), {
        success: t("motor.ratioSet", { ratio }),
      }),
    [run],
  );

  /**
   * Starts (1) or ends (0) the assist-valley mode. The cadence is sent separately
   * with `setRpm` (ERPM). Mode 2 (brake) is refused by the board for now.
   */
  const setResistMode = useCallback(
    (mode: number) =>
      run("resistMode", async (c) => {
        await c.setResistMode(mode);
        return mode;
      }, {
        success: mode === ResistMode.NONE ? t("resist.ended") : undefined,
        needsArmed: mode !== ResistMode.NONE,
      }),
    [run],
  );

  /** Replaces the board's zones with `zones` (clear, stage each, commit). */
  const applyResistZones = useCallback(
    (zones: ResistZoneInput[]) =>
      run("resistZones", (c) => c.applyResistZones(zones), {
        success: zones.length === 0 ? t("resist.zones.cleared") : tp("resist.zones.sent", zones.length, { count: zones.length }),
      }),
    [run],
  );

  /** Reads the zones active on the board. Resolves with the list, or null on failure. */
  const readResistZones = useCallback(
    (): Promise<ResistZone[] | null> => run("resistRead", (c) => c.getResistZones()),
    [run],
  );

  /** Asks for the static hold; it starts once the pedal is nearly still. */
  const engageHold = useCallback(
    (amps: number) =>
      run("holdEngage", (c) => c.engageHold(amps), {
        success: t("resist.hold.engaged", { amps: Number(amps.toFixed(2)) }),
        needsArmed: true,
      }),
    [run],
  );

  /** Releases the hold (or the active mode) in a short ramp. */
  const releaseHold = useCallback(
    () => run("holdRelease", (c) => c.releaseHold(), { success: t("resist.released") }),
    [run],
  );

  /** Adjusts the controller gains (bench tuning). */
  const tuneResist = useCallback(
    (gains: ResistGains) =>
      run("resistTune", (c) => c.tuneResist(gains), { success: t("resist.tune.done") }),
    [run],
  );

  /** Fetches one telemetry sample and stores it in `telemetry`. */
  const requestTelemetry = useCallback(
    () =>
      run("telemetry", async (c) => {
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
    setResistMode,
    applyResistZones,
    readResistZones,
    engageHold,
    releaseHold,
    tuneResist,
    requestTelemetry,
    /** Last resistance sample pushed by the board in this session, or null. */
    resistance,
    /** Last status byte the board reported (TelemetryStatus bits), or null before the first. */
    boardStatus,
    /** Last telemetry sample of this session, or null. */
    telemetry,
    /** True while a command round-trip is in flight. */
    isBusy,
    /** Last command error (including ACK timeouts), cleared on the next command. */
    error,
    isConnected: session != null,
    /** What the app knows about the board's arming state (learned from ACKs / NACKs). */
    systemState,
    /** The command currently in flight, or null. */
    pending,
    /** Latest user-facing outcome (success, refusal, timeout); null once dismissed. */
    feedback,
    dismissFeedback,
    observeStatus,
  };
}
