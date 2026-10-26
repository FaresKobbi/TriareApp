import { useCallback, useEffect, useState } from "react";
import {
  TelemetryStatus,
  ZERO_SEARCH_EXPECTED_MAX_MS,
  ZeroInfoFlag,
} from "../constants/triareProtocol";
import { ZeroInfo } from "../protocol/TriareFrames";
import { SystemState } from "../utils/commandFeedback";

/** How often the zero state is read while a search or a learning is running. */
export const ZERO_POLL_MS = 1000;

/**
 * What `usePedalZero` needs from `useMotorControl`. Each command resolves with `null` when it
 * failed (the motor hook has already shown why in its toast) and with anything else when it worked.
 */
export type PedalZeroMotor = {
  systemState: SystemState;
  /** Status byte last reported by the board (`TelemetryStatus` bits), or null before the first. */
  boardStatus: number | null;
  zeroInfo: ZeroInfo | null;
  enable: () => Promise<unknown>;
  calibrateCrank: () => Promise<unknown>;
  startZeroSearch: () => Promise<unknown>;
  cancelZeroSearch: () => Promise<unknown>;
  refreshZeroInfo: () => Promise<ZeroInfo | null>;
};

/**
 * Why a zero action was not sent. The app checks these first because the board would either
 * refuse (`ZERO_SETUP`) or, for the learning, accept the command and silently not arm it.
 */
export type PedalZeroProblem =
  /** No gear ratio was sent in this boot: the angle has no scale, so nothing can be learned or found. */
  | "noRatio"
  /** The sensor index was never learned: turn the crank by hand once ("learn index"). */
  | "noIndex";

/**
 * Logic of the "pedal zero" card: reading the state of the index sensor, learning its index by
 * hand and finding the zero with the motor.
 *
 * The motor search is the dangerous part (the crank turns), so `searchWithMotor` does NOT ask the
 * user anything: the screen must confirm first, then call it. It arms the system when needed
 * (the confirmation covers that too), starts the search and then follows it: the board announces
 * the end of a search through the status byte, and while a search or a learning runs the state
 * is also read every second, so the card ends up showing what happened.
 *
 * @param enabled true while the card is on screen and connected; nothing is read or polled otherwise.
 */
export function usePedalZero(motor: PedalZeroMotor, enabled: boolean) {
  const { boardStatus, zeroInfo, systemState, refreshZeroInfo } = motor;
  const [problem, setProblem] = useState<PedalZeroProblem | null>(null);
  const [slow, setSlow] = useState(false);

  const flags = zeroInfo?.flags ?? 0;
  const searching =
    (boardStatus != null && (boardStatus & TelemetryStatus.ZERO_SEARCH) !== 0) ||
    (flags & ZeroInfoFlag.SEARCHING) !== 0;
  const learning = (flags & ZeroInfoFlag.LEARNING) !== 0;
  const valid =
    boardStatus != null
      ? (boardStatus & TelemetryStatus.ZERO_VALID) !== 0
      : (flags & ZeroInfoFlag.VALID) !== 0;

  // Read the state when the card appears, and whenever the board says the zero changed
  // (confirmed by the sensor, or a search started / ended).
  const zeroBits =
    boardStatus == null ? null : boardStatus & (TelemetryStatus.ZERO_VALID | TelemetryStatus.ZERO_SEARCH);
  useEffect(() => {
    if (enabled) void refreshZeroInfo();
  }, [enabled, zeroBits, refreshZeroInfo]);

  // Follow a search or a learning until it ends.
  const following = enabled && (searching || learning);
  useEffect(() => {
    if (!following) return;
    const timer = setInterval(() => void refreshZeroInfo(), ZERO_POLL_MS);
    return () => clearInterval(timer);
  }, [following, refreshZeroInfo]);

  // The board gives up on its own after about 11 s; if it is still searching long after that,
  // say so instead of letting the user wait.
  useEffect(() => {
    setSlow(false);
    if (!enabled || !searching) return;
    const timer = setTimeout(() => setSlow(true), ZERO_SEARCH_EXPECTED_MAX_MS);
    return () => clearTimeout(timer);
  }, [enabled, searching]);

  /**
   * Learns the sensor index: the user puts the left pedal up (before calling this) and then turns
   * the crank by hand, in the pedalling direction, until the sensor fires. Resolves false when it
   * could not be started.
   */
  const learnByHand = useCallback(async (): Promise<boolean> => {
    setProblem(null);
    const info = await refreshZeroInfo();
    if (info && (info.flags & ZeroInfoFlag.RATIO_SET) === 0) {
      setProblem("noRatio");
      return false;
    }
    if ((await motor.calibrateCrank()) === null) return false;
    await refreshZeroInfo();
    return true;
  }, [motor, refreshZeroInfo]);

  /**
   * Finds the zero with the motor. Only call after the user confirmed (the crank turns).
   * Resolves false when the search was not started.
   */
  const searchWithMotor = useCallback(async (): Promise<boolean> => {
    setProblem(null);
    const info = await refreshZeroInfo();
    if (info) {
      if ((info.flags & ZeroInfoFlag.RATIO_SET) === 0) {
        setProblem("noRatio");
        return false;
      }
      if ((info.flags & ZeroInfoFlag.INDEX_KNOWN) === 0) {
        setProblem("noIndex");
        return false;
      }
    }
    // A known-disarmed board is armed here; an unknown or armed one is left alone (the board
    // refuses with "not armed" and the toast offers Enable).
    if (systemState === "disarmed" && (await motor.enable()) === null) return false;
    if ((await motor.startZeroSearch()) === null) return false;
    await refreshZeroInfo();
    return true;
  }, [motor, refreshZeroInfo, systemState]);

  /** Cancels a search in progress; the motor is released. */
  const cancel = useCallback(async (): Promise<void> => {
    await motor.cancelZeroSearch();
    await refreshZeroInfo();
  }, [motor, refreshZeroInfo]);

  return {
    /** Last `ZERO_GET` answer, or null before the first. */
    info: zeroInfo,
    /** The sensor confirmed the zero since the last boot / ratio change. */
    valid,
    /** The motor is turning the crank to find the index. */
    searching,
    /** Waiting for the user to turn the crank by hand so the index can be learned. */
    learning,
    /** The search has run much longer than the board allows: something is wrong. */
    slow,
    /** Why the last action was not sent, or null. Cleared by the next action. */
    problem,
    learnByHand,
    searchWithMotor,
    cancel,
    refresh: refreshZeroInfo,
  };
}
