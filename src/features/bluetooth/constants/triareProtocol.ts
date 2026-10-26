/**
 * TRIARE application-level command protocol (WBA65 firmware).
 *
 * Source of truth: `triare_host_ble.py`. Every command is written to the TX
 * characteristic (write without response) and elicits exactly one
 * notification on the RX characteristic:
 *
 * - State-changing commands respond with `[ACK, <echoed opcode>]`.
 * - Data commands respond with `[<echoed opcode>, ...payload]`.
 *
 * Float payloads are IEEE-754 float32, little-endian (`struct.pack('<f')`).
 */
export const TriareOpcode = {
  /** No payload. Response: `[GET_DEVEUI, 8-byte DevEUI]`. */
  GET_DEVEUI: 0x01,
  /** Payload: arbitrary bytes. Response echoes them back. Diagnostic only. */
  ECHO: 0x02,
  /** No payload. Arms the system; motor stays freewheeling. ACK framing. */
  SYSTEM_ENABLE: 0x10,
  /** No payload. Disarms the system. ACK framing. */
  SYSTEM_DISABLE: 0x11,
  /** Payload: 1× LE float32 target ERPM (electrical RPM). ACK framing. */
  SET_RPM: 0x12,
  /** No payload. Response: `[REQ_TELEMETRY, 4× LE float32, fault byte]`. */
  REQ_TELEMETRY: 0x13,
  /** Generic acknowledgment opcode used in response frames. Never sent by host. */
  ACK: 0x14,
  /** Payload: 1× LE float32 in [-1.0, 1.0]; negative reverses the motor. ACK framing. */
  SET_DUTY: 0x15,
  /** No payload. Freewheels the motor; system stays armed. ACK framing. */
  STOP: 0x16,
  /** No payload. Zeroes the crank angle at the current position. ACK framing. */
  CALIBRATE_CRANK: 0x17,
  /**
   * Payload: 1× LE float32 (crank teeth ÷ motor teeth). ACK framing on success.
   * Rejected with a NACK (reason INVALID_VALUE) if ≤ 0 or non-finite.
   */
  SET_GEAR_RATIO: 0x18,
  /**
   * Response only, never sent by the host: `[NACK, <rejected opcode>, <reason>]`.
   * The firmware sends it instead of an ACK when it refuses a command (see
   * `NackReason`). Firmware older than this opcode stays silent instead, which
   * the app sees as an ACK timeout.
   */
  NACK: 0x1F,
  /**
   * Payload: 1 byte, 1 = start / 0 = stop streaming telemetry. ACK framing.
   * While on, the board sends a `STREAM_FRAME` for every new motor-controller
   * sample (20 Hz) with no request from the app. Firmware older than this
   * opcode stays silent, which the app sees as an ACK timeout and answers by
   * polling instead.
   */
  STREAM: 0x1C,
  /**
   * Notification only, never a reply to a command: one telemetry sample pushed
   * while streaming is on (see `STREAM_FRAME_LENGTH` for the layout).
   */
  STREAM_FRAME: 0x1D,
  /**
   * Notification only, never a reply to a command: `[STATUS_EVENT, status]`,
   * where `status` is a `TelemetryStatus` bitfield. The firmware sends it when
   * the system state changes (emergency button, fault, any command) and right
   * after the app enables notifications, so the app never has to poll for the
   * state. Firmware older than this opcode never sends it.
   */
  STATUS_EVENT: 0x1E,


  // --- Physiotherapy (torque) modes — see PROJETO_MODO_RESISTENCIA.md --------

  /**
   * Payload: 1 byte, a `ResistMode` (0 none, 1 assist valley, 2 brake). ACK
   * framing. Needs the system armed. Mode 2 is refused (NACK `NO_REGEN_PATH`)
   * until the hardware can take back the energy.
   */
  RESIST_MODE: 0x20,
  /**
   * Payload (15 bytes): zone index u8, start f32°, end f32°, type u8 (0 = % of
   * assist kept), value f32, edge u8°. Stages a draft only; nothing changes
   * until `RESIST_COMMIT`. ACK framing.
   */
  RESIST_ZONE: 0x21,
  /** No payload. Publishes the staged zones atomically. ACK framing. */
  RESIST_COMMIT: 0x22,
  /** No payload. Clears the draft and the active zones. ACK framing. */
  RESIST_CLEAR: 0x23,
  /**
   * Payload: 1× LE float32 holding current in amperes. Static hold (mode C):
   * waits for the pedal to be nearly still, then holds the position. Needs the
   * system armed and a gear ratio of at least `HOLD_MIN_GEAR_RATIO`. ACK framing.
   */
  HOLD_ENGAGE: 0x24,
  /** No payload. Releases the hold in a ramp (never brakes). ACK framing. */
  HOLD_RELEASE: 0x25,
  /**
   * No payload. Response: one notification per active zone (see
   * `RESIST_ZONE_REPLY_LENGTH`), or a single one with index 0xFF when none.
   */
  RESIST_GET: 0x26,
  /** Payload: 4× LE float32 (kp_speed, ki_speed, kp_pos, kd_pos). ACK framing. */
  RESIST_TUNE: 0x27,
  /**
   * Notification only, never a reply to a command: pushed after each stream
   * frame while a physiotherapy mode is active (`RESIST_FRAME_LENGTH` bytes).
   */
  RESIST_FRAME: 0x29,
  /**
   * Payload: u8 (1 = search the crank zero by turning the motor slowly until the index
   * sensor fires, 0 = cancel). ACK framing. NACK `ZERO_SETUP` when no index was learned yet.
   * The app MUST ask the user to confirm first (the crank turns; feet off the pedals).
   */
  ZERO_SEARCH: 0x28,
  /**
   * No payload. Response (15 bytes): `[0x2A][u8 flags][u8 searchState][f32 indexAngleDeg]
   * [f32 lastDriftDeg][u16 pulses][u16 slips]`. Poll it when the status byte changes
   * (`ZERO_VALID` / `ZERO_SEARCH`).
   */
  ZERO_GET: 0x2a,
} as const;

export type TriareOpcode = (typeof TriareOpcode)[keyof typeof TriareOpcode];

/** Why the firmware refused a command (third byte of a NACK frame). */
export const NackReason = {
  /** SET_RPM / SET_DUTY while the system is disarmed. */
  NOT_ARMED: 0x01,
  /** Emergency stop latched, or SYSTEM_ENABLE while the button is still pressed. */
  EMERGENCY_STOP: 0x02,
  /** The motor controller reports a fault; arming and motion are blocked. */
  FAULT: 0x03,
  /** Malformed or out-of-range payload (e.g. gear ratio <= 0, NaN). */
  INVALID_VALUE: 0x04,
  /** Brake requested but there is no way to return the energy (mode B). */
  NO_REGEN_PATH: 0x05,
  /** Crank zero not commissioned: no index angle learned, or gear ratio not set yet. */
  ZERO_SETUP: 0x06,
} as const;

export type NackReason = (typeof NackReason)[keyof typeof NackReason];

/** Readable name for a NACK reason byte, including values this app does not know yet. */
export function nackReasonName(reason: number): string {
  switch (reason) {
    case NackReason.NOT_ARMED:
      return "not armed";
    case NackReason.EMERGENCY_STOP:
      return "emergency stop";
    case NackReason.FAULT:
      return "fault";
    case NackReason.INVALID_VALUE:
      return "invalid value";
    case NackReason.NO_REGEN_PATH:
      return "no energy return path";
    case NackReason.ZERO_SETUP:
      return "crank zero not commissioned";
    default:
      return `reason 0x${reason.toString(16).padStart(2, "0").toUpperCase()}`;
  }
}

/** Max time to wait for the response notification (ACK_TIMEOUT in the reference script). */
export const ACK_TIMEOUT_MS = 3000;

export const DEVEUI_LENGTH = 8;

/**
* Telemetry frame: opcode + 4× float32 (rpm, current, voltage, temp)
* + 1× float32 crank angle (degrees, 0–360) + fault byte.
* Grew from 18 → 22 bytes when crank angle was added; fault byte offset
* moved from 17 to 21 as a result.
*
* This is the minimum accepted length. Current firmware appends one status
* byte (23 bytes, see TELEMETRY_STATUS_OFFSET); older firmware sends 22 and
* the app then simply has no live arming/emergency state.
*/
export const TELEMETRY_FRAME_LENGTH = 22;

/**
 * Stream frame (27 bytes): opcode, u32 LE board tick in ms (when the motor
 * controller sample was received; wraps every ~49 days), 5× float32 LE (rpm,
 * current, voltage, FET temperature, crank angle), fault byte, status byte.
 */
export const STREAM_FRAME_LENGTH = 27;

/** Offset of the status byte (optional last byte of the telemetry frame). */
export const TELEMETRY_STATUS_OFFSET = 22;

/** Bits of the telemetry status byte. Keep equal to TRIARE_STATUS_* in the firmware. */
export const TelemetryStatus = {
  /** System armed (firmware state RUNNING). */
  ARMED: 0x01,
  /** Emergency stop latched. */
  EMERGENCY: 0x02,
  /** Armed with a speed/duty setpoint active (the motor is being driven). */
  DRIVING: 0x04,
  /** A physiotherapy mode (assist valley or hold) is active. */
  RESISTANCE: 0x08,
  /** The motor current is being limited (thermal limit or yield). */
  LIMITING: 0x10,
  /** The crank zero was confirmed by the index (PAS) sensor since the last boot / ratio change. */
  ZERO_VALID: 0x20,
  /** The firmware is turning the motor slowly to find the index pulse. */
  ZERO_SEARCH: 0x40,
} as const;

/** Physiotherapy modes (`RESIST_MODE` payload and field of `RESIST_FRAME`). Keep equal to the firmware. */
export const ResistMode = {
  NONE: 0,
  /** A: cadence reference with assist reduced by crank angle. */
  ASSIST_VALLEY: 1,
  /** B: brake. Refused for now (no energy return path). */
  BRAKE: 2,
  /** C: static hold (only reported by the board; started with `HOLD_ENGAGE`). */
  HOLD: 3,
} as const;

export type ResistMode = (typeof ResistMode)[keyof typeof ResistMode];

/** What the board is doing inside the active mode (field of `RESIST_FRAME`). */
export const ResistPhase = {
  IDLE: 0,
  ACTIVE: 1,
  /** Hold requested, waiting for the pedal to be nearly still. */
  WAIT_STILL: 2,
  HOLDING: 3,
  /** Current ramping down to zero. */
  RELEASING: 4,
} as const;

export type ResistPhase = (typeof ResistPhase)[keyof typeof ResistPhase];

/** Bits of the limit byte of `RESIST_FRAME`. */
export const ResistLimit = {
  /** Thermal model is limiting the current. */
  THERMAL: 0x01,
  /** The hold yielded because the pedal was forced. */
  YIELD: 0x02,
  /** The hold ended at its maximum time. */
  TIMEOUT: 0x04,
} as const;

/** Zone type byte. Only "assist limit" exists while there is no energy return path. */
export const ResistZoneType = {
  /** `value` = percentage of the assist kept inside the zone (0–100). */
  ASSIST_LIMIT: 0,
} as const;

export const RESIST_MAX_ZONES = 8;
export const RESIST_MAX_EDGE_DEG = 60;
/** Largest holding current the firmware accepts (A). */
export const HOLD_MAX_CURRENT_A = 3;
/** The hold needs this gear ratio or more (crank angle resolution), else INVALID_VALUE. */
export const HOLD_MIN_GEAR_RATIO = 3;
/** Resistance frame: opcode, u32 tick, f32 current, f32 assist factor, mode, phase, limits, f32 thermal %. */
export const RESIST_FRAME_LENGTH = 20;
/** One zone as reported by `RESIST_GET`: opcode, index, total, f32 start, f32 end, type, f32 value, edge. */
export const RESIST_ZONE_REPLY_LENGTH = 17;
/** `RESIST_GET` index byte meaning "no zones". */
export const RESIST_NO_ZONES_INDEX = 0xff;

/** `ZERO_GET` reply: opcode, flags u8, search state u8, f32 index angle, f32 last drift, u16 pulses, u16 slips. */
export const ZERO_INFO_LENGTH = 15;

/** Bits of the `ZERO_GET` flags byte. Keep equal to TRIARE_ZERO_INFO_* in the firmware. */
export const ZeroInfoFlag = {
  /** The sensor index angle is known (learned by hand or read from flash). */
  INDEX_KNOWN: 0x01,
  /** The sensor confirmed the zero since the last boot / ratio change. */
  VALID: 0x02,
  /** Waiting for the sensor pulse to learn the index (crank turned by hand). */
  LEARNING: 0x04,
  /** The motor is turning the crank slowly to find the index pulse. */
  SEARCHING: 0x08,
  /** A gear ratio was sent in this boot. */
  RATIO_SET: 0x10,
  /** The index was written to / read from flash successfully. */
  SAVED: 0x20,
  /** The reverse-direction index was measured this boot: reverse pulses now check the zero too. */
  REV_KNOWN: 0x40,
} as const;

/** Outcome of the last zero search (`ZERO_GET` search-state byte). Keep equal to triare_zero_search_state_t. */
export const ZeroSearchState = {
  /** No search since boot. */
  NONE: 0,
  RUNNING: 1,
  /** The sensor fired: the zero is valid. */
  FOUND: 2,
  /** About 1.25 turns without a pulse (sensor off or misaligned). */
  TIMEOUT: 3,
  /** The crank did not move (foot on the pedal, blocked). */
  STALLED: 4,
  /** The crank moved against the direction the index was learned in. */
  WRONG_DIR: 5,
  /** Stop, disarm, fault, emergency or another command ended it. */
  ABORTED: 6,
  /** The motor controller stopped answering. */
  STALE: 7,
} as const;

/**
 * Longest a zero search should take: the board gives up after 1.25 turns at 8 rpm plus a
 * margin (about 11.5 s). The app does not cut it short; it only warns when it lasts longer.
 */
export const ZERO_SEARCH_EXPECTED_MAX_MS = 20000;

export const DUTY_MIN = -1.0;
export const DUTY_MAX = 1.0;

/** Devices advertise as `TRI-XXXXXX` (DEFAULT_NAME_PREFIX in the reference script). */
export const TRIARE_DEVICE_NAME_PREFIX = "TRI-";
