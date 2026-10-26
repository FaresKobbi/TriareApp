/** Typed views of the frames the device sends on the RX (notify) characteristic. */

/** Parsed payload of a REQ_TELEMETRY response. */
export type TelemetryData = {
  /** Electrical RPM. Conversion to wheel speed needs motor/wheel parameters (not in the protocol yet). */
  rpm: number;
  /** Motor current, amperes. */
  current: number;
  /** Battery pack voltage, volts. */
  voltage: number;
  /** FET temperature, °C. */
  temp: number;
  /**
  * Crank angle in degrees (0–360), already converted by firmware using the
  * gear ratio set via SET_GEAR_RATIO. Left pedal = this value; right pedal =
  * this value + 180° (always opposite). Re-zeroed by CALIBRATE_CRANK and,
  * as a side effect, by a successful SET_GEAR_RATIO.
  */
 crankAngleDeg: number;
  /** VESC fault code. 0 = no fault; other values are not documented in the protocol reference. */
  fault: number;
  /**
   * Bitfield of `TelemetryStatus` (armed / emergency stop / driving).
   * `undefined` when the firmware predates the status byte (22-byte frame).
   */
  status?: number;
  /**
   * Board clock (ms, wraps at 2^32) at which the motor controller sample was
   * received. Only stream frames carry it; use differences between samples,
   * never the absolute value.
   */
  timestampMs?: number;
};

/** One resistance sample pushed by the board while a physiotherapy mode is active. */
export type ResistanceData = {
  /** Board clock (ms, wraps at 2^32). Use differences, never the absolute value. */
  timestampMs: number;
  /** Current the controller commands, amperes (signed). */
  commandedCurrent: number;
  /** Fraction of the assist applied right now, 0–1 (0 = inside a no-assist zone). */
  assistFactor: number;
  /** A `ResistMode` byte. */
  mode: number;
  /** A `ResistPhase` byte. */
  phase: number;
  /** Bitfield of `ResistLimit`. */
  limitFlags: number;
  /** Thermal model, % of the continuous current limit (100 = at the limit). */
  thermalPercent: number;
};

/** A no-assist/low-assist zone as stored on the board. Angles are crank degrees, 0–360. */
export type ResistZone = {
  index: number;
  startDeg: number;
  endDeg: number;
  /** A `ResistZoneType` byte. */
  type: number;
  /** Percentage of the assist kept inside the zone, 0–100. */
  valuePercent: number;
  /** Width of the smooth edge, degrees. */
  edgeDeg: number;
};

/** State of the crank zero / index sensor, as answered to `ZERO_GET`. */
export type ZeroInfo = {
  /** Bitfield of `ZeroInfoFlag`. */
  flags: number;
  /** A `ZeroSearchState` byte: outcome of the last search (0 before any). */
  searchState: number;
  /** Crank angle at which the sensor fires (degrees, in the pedal reference). Meaningful when the index is known. */
  indexAngleDeg: number;
  /** Deviation of the last pulse the board checked, degrees. */
  lastDriftDeg: number;
  /** Sensor pulses accepted since boot. */
  pulses: number;
  /** Pulses that disagreed with the tachometer by more than 10° (the crank angle slipped). */
  slips: number;
};

/**
 * Discriminated union of every frame shape the firmware produces.
 *
 * `unrecognized` is a first-class case (not an exception): the firmware may
 * evolve and an unknown frame must not crash the notification pipeline.
 */
export type DecodedFrame =
  | { kind: "ack"; ackedOpcode: number }
  /** The firmware refused `rejectedOpcode`; `reason` is a `NackReason` byte (may be unknown to this app). */
  | { kind: "nack"; rejectedOpcode: number; reason: number }
  | { kind: "devEui"; devEui: Uint8Array }
  | { kind: "echo"; payload: Uint8Array }
  | { kind: "telemetry"; telemetry: TelemetryData }
  /** One telemetry sample pushed by the board while streaming is on (carries `timestampMs`). */
  | { kind: "stream"; telemetry: TelemetryData }
  /** Unsolicited state change from the firmware; `status` is a `TelemetryStatus` bitfield. */
  | { kind: "status"; status: number }
  /** Unsolicited resistance sample, sent while a physiotherapy mode is active. */
  | { kind: "resistance"; resistance: ResistanceData }
  /** One reply to RESIST_GET. `zone` is null (and `total` 0) when the board has no zones. */
  | { kind: "resistZone"; zone: ResistZone | null; total: number }
  /** Reply to ZERO_GET. */
  | { kind: "zero"; zero: ZeroInfo }
  | { kind: "unrecognized"; raw: Uint8Array };
