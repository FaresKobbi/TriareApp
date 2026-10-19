import {
  DEVEUI_LENGTH,
  DUTY_MAX,
  DUTY_MIN,
  HOLD_MAX_CURRENT_A,
  RESIST_FRAME_LENGTH,
  RESIST_MAX_EDGE_DEG,
  RESIST_MAX_ZONES,
  RESIST_NO_ZONES_INDEX,
  RESIST_ZONE_REPLY_LENGTH,
  ResistZoneType,
  STREAM_FRAME_LENGTH,
  TELEMETRY_FRAME_LENGTH,
  TELEMETRY_STATUS_OFFSET,
  TriareOpcode,
} from "../constants/triareProtocol";
import { CommandCodec, ResistGains, ResistZoneInput } from "./CommandCodec";
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
 * - refused commands get `[NACK, <rejected opcode>, <reason>]`;
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

  encodeCalibrateCrank(): Uint8Array {
   return opcodeOnly(TriareOpcode.CALIBRATE_CRANK);
  }

  encodeSetGearRatio(ratio: number): Uint8Array {
   return opcodeWithFloat32(TriareOpcode.SET_GEAR_RATIO, ratio);
  }

  encodeRequestTelemetry(): Uint8Array {
    return opcodeOnly(TriareOpcode.REQ_TELEMETRY);
  }

  encodeResistMode(mode: number): Uint8Array {
    if (mode !== 0 && mode !== 1 && mode !== 2) {
      throw new RangeError(`Resistance mode must be 0, 1 or 2, got ${mode}`);
    }
    return Uint8Array.of(TriareOpcode.RESIST_MODE, mode);
  }

  encodeResistZone(zone: ResistZoneInput): Uint8Array {
    const edge = zone.edgeDeg ?? 15;
    if (!Number.isInteger(zone.index) || zone.index < 0 || zone.index >= RESIST_MAX_ZONES) {
      throw new RangeError(`Zone index must be 0–${RESIST_MAX_ZONES - 1}, got ${zone.index}`);
    }
    if (!(zone.startDeg >= 0 && zone.startDeg <= 360) || !(zone.endDeg >= 0 && zone.endDeg <= 360)) {
      throw new RangeError(`Zone angles must be within [0, 360], got ${zone.startDeg}–${zone.endDeg}`);
    }
    let length = zone.endDeg - zone.startDeg;
    if (length < 0) length += 360;
    if (length < 1) throw new RangeError("A zone must span at least 1 degree");
    if (!(zone.valuePercent >= 0 && zone.valuePercent <= 100)) {
      throw new RangeError(`Zone percentage must be within [0, 100], got ${zone.valuePercent}`);
    }
    if (!Number.isInteger(edge) || edge < 0 || edge > RESIST_MAX_EDGE_DEG) {
      throw new RangeError(`Zone edge must be an integer within [0, ${RESIST_MAX_EDGE_DEG}], got ${edge}`);
    }
    const frame = new Uint8Array(16);
    const view = new DataView(frame.buffer);
    frame[0] = TriareOpcode.RESIST_ZONE;
    frame[1] = zone.index;
    view.setFloat32(2, zone.startDeg, true);
    view.setFloat32(6, zone.endDeg, true);
    frame[10] = ResistZoneType.ASSIST_LIMIT;
    view.setFloat32(11, zone.valuePercent, true);
    frame[15] = edge;
    return frame;
  }

  encodeResistCommit(): Uint8Array {
    return opcodeOnly(TriareOpcode.RESIST_COMMIT);
  }

  encodeResistClear(): Uint8Array {
    return opcodeOnly(TriareOpcode.RESIST_CLEAR);
  }

  encodeResistGet(): Uint8Array {
    return opcodeOnly(TriareOpcode.RESIST_GET);
  }

  encodeHoldEngage(amps: number): Uint8Array {
    if (!(amps > 0 && amps <= HOLD_MAX_CURRENT_A)) {
      throw new RangeError(`Holding current must be within (0, ${HOLD_MAX_CURRENT_A}] A, got ${amps}`);
    }
    return opcodeWithFloat32(TriareOpcode.HOLD_ENGAGE, amps);
  }

  encodeHoldRelease(): Uint8Array {
    return opcodeOnly(TriareOpcode.HOLD_RELEASE);
  }

  encodeResistTune(gains: ResistGains): Uint8Array {
    const values = [gains.kpSpeed, gains.kiSpeed, gains.kpPos, gains.kdPos];
    if (!values.every((v) => Number.isFinite(v) && v >= 0)) {
      throw new RangeError("Gains must be finite and not negative");
    }
    const frame = new Uint8Array(17);
    const view = new DataView(frame.buffer);
    frame[0] = TriareOpcode.RESIST_TUNE;
    values.forEach((v, i) => view.setFloat32(1 + 4 * i, v, true));
    return frame;
  }

  encodeStream(enable: boolean): Uint8Array {
    const frame = new Uint8Array(2);
    frame[0] = TriareOpcode.STREAM;
    frame[1] = enable ? 1 : 0;
    return frame;
  }

  decode(frame: Uint8Array): DecodedFrame {
    if (frame.length === 0) {
      return { kind: "unrecognized", raw: frame };
    }

    const opcode = frame[0];

    if (opcode === TriareOpcode.ACK && frame.length >= 2) {
      return { kind: "ack", ackedOpcode: frame[1] };
    }

    if (opcode === TriareOpcode.STREAM_FRAME && frame.length >= STREAM_FRAME_LENGTH) {
      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      return {
        kind: "stream",
        telemetry: {
          timestampMs: view.getUint32(1, true),
          rpm: view.getFloat32(5, true),
          current: view.getFloat32(9, true),
          voltage: view.getFloat32(13, true),
          temp: view.getFloat32(17, true),
          crankAngleDeg: view.getFloat32(21, true),
          fault: frame[25],
          status: frame[26],
        },
      };
    }

    if (opcode === TriareOpcode.RESIST_FRAME && frame.length >= RESIST_FRAME_LENGTH) {
      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      return {
        kind: "resistance",
        resistance: {
          timestampMs: view.getUint32(1, true),
          commandedCurrent: view.getFloat32(5, true),
          assistFactor: view.getFloat32(9, true),
          mode: frame[13],
          phase: frame[14],
          limitFlags: frame[15],
          thermalPercent: view.getFloat32(16, true),
        },
      };
    }

    if (opcode === TriareOpcode.RESIST_GET && frame.length >= 3 && frame[1] === RESIST_NO_ZONES_INDEX) {
      return { kind: "resistZone", zone: null, total: 0 };
    }

    if (opcode === TriareOpcode.RESIST_GET && frame.length >= RESIST_ZONE_REPLY_LENGTH) {
      const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
      return {
        kind: "resistZone",
        total: frame[2],
        zone: {
          index: frame[1],
          startDeg: view.getFloat32(3, true),
          endDeg: view.getFloat32(7, true),
          type: frame[11],
          valuePercent: view.getFloat32(12, true),
          edgeDeg: frame[16],
        },
      };
    }

    if (opcode === TriareOpcode.STATUS_EVENT && frame.length >= 2) {
      return { kind: "status", status: frame[1] };
    }

    if (opcode === TriareOpcode.NACK && frame.length >= 3) {
      return { kind: "nack", rejectedOpcode: frame[1], reason: frame[2] };
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
          status: frame.length > TELEMETRY_STATUS_OFFSET ? frame[TELEMETRY_STATUS_OFFSET] : undefined,
        },
      };
    }

    return { kind: "unrecognized", raw: frame };
  }
}
