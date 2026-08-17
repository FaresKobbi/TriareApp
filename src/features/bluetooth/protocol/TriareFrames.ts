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
};

/**
 * Discriminated union of every frame shape the firmware produces.
 *
 * `unrecognized` is a first-class case (not an exception): the firmware may
 * evolve and an unknown frame must not crash the notification pipeline.
 */
export type DecodedFrame =
  | { kind: "ack"; ackedOpcode: number }
  | { kind: "devEui"; devEui: Uint8Array }
  | { kind: "echo"; payload: Uint8Array }
  | { kind: "telemetry"; telemetry: TelemetryData }
  | { kind: "unrecognized"; raw: Uint8Array };
