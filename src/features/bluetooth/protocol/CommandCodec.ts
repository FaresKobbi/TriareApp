import { DecodedFrame } from "./TriareFrames";

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

  /** Never throws on malformed input — returns an `unrecognized` frame instead. */
  decode(frame: Uint8Array): DecodedFrame;
}
