import { DecodedFrame } from "./TriareFrames";

/** A zone to send to the board. Angles are crank degrees, 0–360 (start > end wraps around zero). */
export type ResistZoneInput = {
  /** Slot, 0–7. */
  index: number;
  startDeg: number;
  endDeg: number;
  /** Percentage of the assist kept inside the zone, 0–100 (0 = no assist). */
  valuePercent: number;
  /** Smooth edge outside the zone, degrees, 0–60. Default 15. */
  edgeDeg?: number;
};

/** Controller gains. The board refuses values outside its safe ranges (NACK). */
export type ResistGains = {
  kpSpeed: number;
  kiSpeed: number;
  kpPos: number;
  kdPos: number;
};

/**
 * Encodes domain commands into wire frames and decodes incoming notification
 * frames into typed results.
 *
 * This is the seam that isolates the rest of the app from the wire format.
 * The firmware protocol is still evolving, so nothing outside `protocol/`
 * may assume opcode values or payload layouts — swap the implementation here
 * if the protocol changes.
 */
export interface CommandCodec {
  encodeGetDevEui(): Uint8Array;
  encodeEcho(payload: Uint8Array): Uint8Array;
  encodeSystemEnable(): Uint8Array;
  encodeSystemDisable(): Uint8Array;
  /** @param erpm Target electrical RPM. */
  encodeSetRpm(erpm: number): Uint8Array;
  /**
   * @param duty Duty cycle in [-1.0, 1.0]; negative reverses the motor.
   * @throws RangeError when out of range.
   */
  encodeSetDuty(duty: number): Uint8Array;
  encodeStop(): Uint8Array;
  encodeRequestTelemetry(): Uint8Array;
  /** Starts (`true`) or stops (`false`) the board's telemetry stream. */
  encodeStream(enable: boolean): Uint8Array;

  /** No payload. Zeroes the crank angle at the current position. */
  encodeCalibrateCrank(): Uint8Array;
  /**
   * @param ratio Gear ratio (crank teeth ÷ motor teeth). Must be > 0 and finite.
   * An invalid value is refused with a NACK (reason INVALID_VALUE) by current
   * firmware; older firmware stays silent, which surfaces as AckTimeoutError.
   * Re-zeroes the crank angle as a side effect on success.
   */
   encodeSetGearRatio(ratio: number): Uint8Array;

  /**
   * @param mode A `ResistMode`: 0 none, 1 assist valley, 2 brake (refused for now).
   * @throws RangeError when not 0, 1 or 2.
   */
  encodeResistMode(mode: number): Uint8Array;
  /**
   * Stages one zone (nothing changes until `encodeResistCommit`).
   * @throws RangeError for a bad index, angle, percentage or edge.
   */
  encodeResistZone(zone: ResistZoneInput): Uint8Array;
  encodeResistCommit(): Uint8Array;
  encodeResistClear(): Uint8Array;
  encodeResistGet(): Uint8Array;
  /**
   * @param amps Holding current, 0 < amps <= HOLD_MAX_CURRENT_A.
   * @throws RangeError when out of range.
   */
  encodeHoldEngage(amps: number): Uint8Array;
  encodeHoldRelease(): Uint8Array;
  /** @throws RangeError for a non-finite or negative gain. */
  encodeResistTune(gains: ResistGains): Uint8Array;

  /** Never throws on malformed input — returns an `unrecognized` frame instead. */
  decode(frame: Uint8Array): DecodedFrame;
}
