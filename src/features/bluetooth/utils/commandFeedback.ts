import { t } from "@/src/i18n";
import { NackReason } from "../constants/triareProtocol";
import { AckTimeoutError, CommandRejectedError } from "../services/TriareCommandService";

/**
 * What the app knows about the board.
 *
 * - `armed`: armed, motor released (freewheel) until a setpoint is sent;
 * - `running`: armed with a speed/duty setpoint active;
 * - `emergency`: emergency stop latched, disarmed until re-armed.
 *
 * `unknown` is the state of a fresh session: the firmware stays armed across a
 * BLE disconnect, so the app cannot assume the board starts disarmed. It
 * becomes known from the first telemetry sample (current firmware) or the
 * first ACK / NACK.
 */
export type SystemState = "unknown" | "armed" | "running" | "disarmed" | "emergency";

export type CommandName =
  | "enable"
  | "disable"
  | "stop"
  | "setRpm"
  | "setDuty"
  | "calibrateCrank"
  | "setGearRatio"
  | "resistMode"
  | "resistZones"
  | "resistRead"
  | "holdEngage"
  | "holdRelease"
  | "resistTune"
  | "telemetry";

export type FeedbackTone = "success" | "error" | "info";

/** One-tap follow-up a toast can offer. */
export type FeedbackAction = "enable";

export type FeedbackContent = {
  tone: FeedbackTone;
  title: string;
  detail?: string;
  action?: FeedbackAction;
};

/** What the user sees after a command, tagged so the toast restarts for each new one. */
export type Feedback = FeedbackContent & { id: number };

export type ErrorOutcome = FeedbackContent & {
  /** State the board is now known to be in, when the failure reveals it. */
  nextState?: SystemState;
};

/**
 * Explains why a motion command cannot be sent right now, or null when it can.
 * Used to stop the request before it leaves the phone: the board would only
 * refuse it, and with older firmware not even answer.
 */
export function blockedFeedback(state: SystemState): FeedbackContent | null {
  switch (state) {
    case "disarmed":
      return {
        tone: "info",
        title: t("feedback.disarmed.title"),
        detail: t("feedback.disarmed.detail"),
        action: "enable",
      };
    case "emergency":
      return {
        tone: "error",
        title: t("feedback.emergency.title"),
        detail: t("feedback.emergency.detail"),
        action: "enable",
      };
    default:
      return null;
  }
}

function rejectionFeedback(command: CommandName, reason: number): ErrorOutcome {
  switch (reason) {
    case NackReason.NOT_ARMED:
      return {
        ...(blockedFeedback("disarmed") as FeedbackContent),
        nextState: "disarmed",
      };
    case NackReason.EMERGENCY_STOP:
      return {
        tone: "error",
        title: t("feedback.emergency.title"),
        detail:
          command === "enable"
            ? t("feedback.emergency.stillPressed")
            : t("feedback.emergency.detail"),
        action: "enable",
        nextState: "emergency",
      };
    case NackReason.FAULT:
      return {
        tone: "error",
        title: t("feedback.fault.title"),
        detail: t("feedback.fault.detail"),
        nextState: "unknown",
      };
    case NackReason.INVALID_VALUE:
      return {
        tone: "error",
        title: t("feedback.invalid.title"),
        detail:
          command === "holdEngage"
            ? t("feedback.invalid.hold")
            : t("feedback.invalid.detail"),
      };
    case NackReason.NO_REGEN_PATH:
      return {
        tone: "error",
        title: t("feedback.noRegen.title"),
        detail: t("feedback.noRegen.detail"),
      };
    default:
      return {
        tone: "error",
        title: t("feedback.rejected.title"),
        detail: t("feedback.rejected.detail", {
          code: reason.toString(16).padStart(2, "0").toUpperCase(),
        }),
      };
  }
}

function timeoutFeedback(command: CommandName): ErrorOutcome {
  switch (command) {
    case "setRpm":
    case "setDuty":
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.motion"),
        action: "enable",
      };
    case "enable":
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.enable"),
      };
    case "setGearRatio":
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.ratio"),
      };
    case "resistMode":
    case "holdEngage":
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.resist"),
        action: "enable",
      };
    case "stop":
    case "disable":
    case "holdRelease":
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.stop"),
      };
    default:
      return {
        tone: "error",
        title: t("feedback.timeout.title"),
        detail: t("feedback.timeout.default"),
      };
  }
}

/** Turns any error thrown by a command into what the user should read. */
export function describeCommandError(error: unknown, command: CommandName): ErrorOutcome {
  if (error instanceof CommandRejectedError) {
    return rejectionFeedback(command, error.reason);
  }
  if (error instanceof AckTimeoutError) {
    return timeoutFeedback(command);
  }
  if (error instanceof RangeError) {
    return { tone: "error", title: t("feedback.rangeError"), detail: error.message };
  }
  if (error instanceof Error) {
    return { tone: "error", title: error.message };
  }
  return { tone: "error", title: t("motor.commandFailed") };
}
