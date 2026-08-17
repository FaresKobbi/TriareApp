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

  // TODO(protocol gap): the requirements include pedal resistance zone
  // configuration, but the current firmware protocol (triare_host_ble.py)
  // defines no resistance-zone command. Confirmed gap — needs firmware-team
  // follow-up. Do not invent an opcode for it here.
} as const;

export type TriareOpcode = (typeof TriareOpcode)[keyof typeof TriareOpcode];

/** Max time to wait for the response notification (ACK_TIMEOUT in the reference script). */
export const ACK_TIMEOUT_MS = 3000;

export const DEVEUI_LENGTH = 8;

/**
* Telemetry frame: opcode + 4× float32 (rpm, current, voltage, temp)
* + 1× float32 crank angle (degrees, 0–360) + fault byte.
* Grew from 18 → 22 bytes when crank angle was added; fault byte offset
* moved from 17 to 21 as a result.
*/
export const TELEMETRY_FRAME_LENGTH = 22;

export const DUTY_MIN = -1.0;
export const DUTY_MAX = 1.0;

/** Devices advertise as `TRI-XXXXXX` (DEFAULT_NAME_PREFIX in the reference script). */
export const TRIARE_DEVICE_NAME_PREFIX = "TRI-";
