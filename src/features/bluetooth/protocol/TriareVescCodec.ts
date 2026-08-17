import {
  DEVEUI_LENGTH,
  DUTY_MAX,
  DUTY_MIN,
  TELEMETRY_FRAME_LENGTH,
  TriareOpcode,
} from "../constants/triareProtocol";
import { CommandCodec } from "./CommandCodec";
import { DecodedFrame } from "./TriareFrames";

function opcodeOnly(opcode: number): Uint8Array {
  return Uint8Array.of(opcode);
}

/** `struct.pack('<f', value)` equivalent: opcode followed by a little-endian float32. */
function opcodeWithFloat32(opcode: number, value: number): Uint8Array {
  const frame = new Uint8Array(5);
  frame[0] = opcode;
  new DataView(frame.buffer).setFloat32(1, value, true);
  return frame;
}

/**
 * Codec for the WBA65 VESC command set defined in `triare_host_ble.py`.
 *
 * Framing convention:
 * - state-changing commands are acknowledged with `[ACK, <echoed opcode>]`;
 * - data commands respond with `[<echoed opcode>, ...payload]`.
 */
export class TriareVescCodec implements CommandCodec {
  encodeGetDevEui(): Uint8Array {
    return opcodeOnly(TriareOpcode.GET_DEVEUI);
  }

  encodeEcho(payload: Uint8Array): Uint8Array {
    const frame = new Uint8Array(1 + payload.length);
    frame[0] = TriareOpcode.ECHO;
    frame.set(payload, 1);
    return frame;
  }

  encodeSystemEnable(): Uint8Array {
    return opcodeOnly(TriareOpcode.SYSTEM_ENABLE);
  }

  encodeSystemDisable(): Uint8Array {
    return opcodeOnly(TriareOpcode.SYSTEM_DISABLE);
  }

  encodeSetRpm(erpm: number): Uint8Array {
    return opcodeWithFloat32(TriareOpcode.SET_RPM, erpm);
  }

  encodeSetDuty(duty: number): Uint8Array {
    if (!(duty >= DUTY_MIN && duty <= DUTY_MAX)) {
      throw new RangeError(`Duty must be within [${DUTY_MIN}, ${DUTY_MAX}], got ${duty}`);
    }
    return opcodeWithFloat32(TriareOpcode.SET_DUTY, duty);
  }

  encodeStop(): Uint8Array {
    return opcodeOnly(TriareOpcode.STOP);
  }

  encodeRequestTelemetry(): Uint8Array {
    return opcodeOnly(TriareOpcode.REQ_TELEMETRY);
  }

  decode(frame: Uint8Array): DecodedFrame {
    if (frame.length === 0) {
      return { kind: "unrecognized", raw: frame };
    }

    const opcode = frame[0];

    if (opcode === TriareOpcode.ACK && frame.length >= 2) {
      return { kind: "ack", ackedOpcode: frame[1] };
    }

    if (opcode === TriareOpcode.GET_DEVEUI && frame.length >= 1 + DEVEUI_LENGTH) {
      return { kind: "devEui", devEui: frame.slice(1, 1 + DEVEUI_LENGTH) };
    }

    if (opcode === TriareOpcode.ECHO) {
      return { kind: "echo", payload: frame.slice(1) };
    }

    if (opcode === TriareOpcode.REQ_TELEMETRY && frame.length >= TELEMETRY_FRAME_LENGTH) {
      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      return {
        kind: "telemetry",
        telemetry: {
          rpm: view.getFloat32(1, true),
          current: view.getFloat32(5, true),
          voltage: view.getFloat32(9, true),
          temp: view.getFloat32(13, true),
          crankAngleDeg: view.getFloat32(17, true),
          fault: frame[21],
        },
      };
    }

    return { kind: "unrecognized", raw: frame };
  }
}
