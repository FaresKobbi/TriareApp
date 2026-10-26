import { DEVEUI_CHAR_UUID, RX_CHAR_UUID, TX_CHAR_UUID } from "../constants/bleUUIDs";
import {
  HOLD_MAX_CURRENT_A,
  HOLD_MIN_GEAR_RATIO,
  NackReason,
  RESIST_MAX_EDGE_DEG,
  RESIST_MAX_ZONES,
  ResistMode,
  TriareOpcode,
  ZeroInfoFlag,
  ZeroSearchState,
} from "../constants/triareProtocol";
import { IBleCharacteristicManager } from "../IBleCharacteristicManager";
import { ResistanceData, ResistZone, TelemetryData } from "../protocol/TriareFrames";
import { base64ToBytes, bytesToBase64 } from "../utils/base64";

/**
 * In-memory simulator of the WBA65 TRIARE firmware, at the GATT layer.
 *
 * Implements `IBleCharacteristicManager`, so the whole protocol stack above
 * it (codec, command service, hooks) runs unchanged against it — used by the
 * integration tests and available for offline development without hardware.
 *
 * Response behavior mirrors what `triare_host_ble.py` demonstrates against
 * real firmware: state-changing commands get `[ACK, opcode]`, data commands
 * get `[opcode, ...payload]`. The real firmware's behavior for motion
 * commands while disarmed is undocumented (the reference script only hints a
 * non-ACK response exists), so this mock ACKs unconditionally; use
 * `respondToCommands = false` to simulate firmware silence (ACK timeout).
 */
export class MockBleCharacteristicManager implements IBleCharacteristicManager {
  /** Test hook: when false, commands are accepted but never answered. */
  respondToCommands = true;

  devEui = Uint8Array.of(0x00, 0x80, 0xe1, 0x2c, 0x00, 0x00, 0x10, 0x8f);
  telemetry: TelemetryData = {
   rpm: 0,
   current: 0,
   voltage: 36.0,
   temp: 25.0,
   crankAngleDeg: 0,
   fault: 0,
 };

  /** Simulated firmware state, inspectable by tests. */
  systemEnabled = false;
  lastTargetErpm: number | null = null;
  lastTargetDuty: number | null = null;
  /** Simulated gear ratio (crank teeth ÷ motor teeth). Default matches firmware boot value. */
  gearRatio = 1.0;
  /** Test hook: false behaves like firmware that predates CMD_STREAM (it ignores the command). */
  supportsStream = true;
  /** True between CMD_STREAM(1) and CMD_STREAM(0). */
  streaming = false;
  /** Every command frame received on the TX characteristic, in order. */
  receivedFrames: Uint8Array[] = [];

  /** Simulated physiotherapy state, inspectable by tests. */
  resistMode: number = ResistMode.NONE;
  holdCurrentA: number | null = null;
  stagedZones: ResistZone[] = [];
  activeZones: ResistZone[] = [];
  resistGains: number[] | null = null;
  /** Test hook: when false, the physiotherapy commands answer with no response (older firmware). */
  supportsResistance = true;

  /**
   * Simulated crank zero (index sensor), inspectable by tests. Mirrors the firmware rules: the
   * learning only arms when a ratio was sent in this boot, and the search needs ratio + index.
   */
  supportsZero = true;
  zeroRatioSet = false;
  zeroIndexKnown = false;
  /** Test hook: the firmware measured the reverse index (reverse pulses check the zero). */
  zeroRevKnown = false;
  zeroLearning = false;
  zeroValid = false;
  zeroSearching = false;
  zeroSearchState: number = ZeroSearchState.NONE;
  zeroIndexAngleDeg = 0;
  zeroLastDriftDeg = 0;
  zeroPulses = 0;
  zeroSlips = 0;

  private notifyListeners = new Set<(value: string) => void>();

  async write(serviceUUID: string, charUUID: string, value: string): Promise<void> {
    await this.writeWithoutResponse(serviceUUID, charUUID, value);
  }

  async writeWithoutResponse(_serviceUUID: string, charUUID: string, value: string): Promise<void> {
    if (charUUID !== TX_CHAR_UUID) return;
    const frame = base64ToBytes(value);
    this.receivedFrames.push(frame);
    if (!this.respondToCommands) return;

    const response = this.handleCommand(frame);
    if (Array.isArray(response)) response.forEach((r) => this.notify(r));
    else if (response) this.notify(response);
  }

  async read(_serviceUUID: string, charUUID: string): Promise<string | null> {
    if (charUUID === DEVEUI_CHAR_UUID) return bytesToBase64(this.devEui);
    return null;
  }

  subscribe(
    _serviceUUID: string,
    charUUID: string,
    onData: (value: string) => void
  ): () => void {
    if (charUUID !== RX_CHAR_UUID) return () => {};
    this.notifyListeners.add(onData);
    return () => this.notifyListeners.delete(onData);
  }

  unsubscribeAll(): void {
    this.notifyListeners.clear();
  }

  /** Test hook: push one STREAM_FRAME, laid out like the firmware's 27-byte push. */
  emitStreamFrame(sample: TelemetryData, timestampMs: number, status = 0): void {
    const frame = new Uint8Array(27);
    const view = new DataView(frame.buffer);
    frame[0] = TriareOpcode.STREAM_FRAME;
    view.setUint32(1, timestampMs >>> 0, true);
    view.setFloat32(5, sample.rpm, true);
    view.setFloat32(9, sample.current, true);
    view.setFloat32(13, sample.voltage, true);
    view.setFloat32(17, sample.temp, true);
    view.setFloat32(21, sample.crankAngleDeg, true);
    frame[25] = sample.fault;
    frame[26] = status;
    this.notify(frame);
  }

  /** Test hook: push one RESIST_FRAME, laid out like the firmware's 20-byte push. */
  emitResistFrame(sample: ResistanceData): void {
    const frame = new Uint8Array(20);
    const view = new DataView(frame.buffer);
    frame[0] = TriareOpcode.RESIST_FRAME;
    view.setUint32(1, sample.timestampMs >>> 0, true);
    view.setFloat32(5, sample.commandedCurrent, true);
    view.setFloat32(9, sample.assistFactor, true);
    frame[13] = sample.mode;
    frame[14] = sample.phase;
    frame[15] = sample.limitFlags;
    view.setFloat32(16, sample.thermalPercent, true);
    this.notify(frame);
  }

  /** Test hook: push an arbitrary raw frame to subscribers (e.g. malformed data). */
  emitRawFrame(frame: Uint8Array): void {
    this.notify(frame);
  }

  private notify(frame: Uint8Array): void {
    const b64 = bytesToBase64(frame);
    // Deliver asynchronously (microtask) like a real notification, so the
    // command write resolves before its response arrives.
    Promise.resolve().then(() => {
      this.notifyListeners.forEach((listener) => listener(b64));
    });
  }

  /**
   * Test hook: the index sensor fires. A learning in progress learns the index; a search in
   * progress ends as FOUND and the status byte changes, as on the board.
   */
  fireZeroSensor(angleDeg = 0): void {
    this.zeroPulses += 1;
    this.zeroIndexAngleDeg = angleDeg;
    if (this.zeroLearning) {
      this.zeroLearning = false;
      this.zeroIndexKnown = true;
    }
    if (this.zeroSearching) {
      this.zeroSearching = false;
      this.zeroSearchState = ZeroSearchState.FOUND;
    }
    this.zeroValid = true;
  }

  /** Test hook: the search ends without finding the sensor (`ZeroSearchState.TIMEOUT`, etc.). */
  endZeroSearch(state: number): void {
    this.zeroSearching = false;
    this.zeroSearchState = state;
  }

  private zeroFlags(): number {
    return (
      (this.zeroIndexKnown ? ZeroInfoFlag.INDEX_KNOWN : 0) |
      (this.zeroValid ? ZeroInfoFlag.VALID : 0) |
      (this.zeroLearning ? ZeroInfoFlag.LEARNING : 0) |
      (this.zeroSearching ? ZeroInfoFlag.SEARCHING : 0) |
      (this.zeroRatioSet ? ZeroInfoFlag.RATIO_SET : 0) |
      (this.zeroRevKnown ? ZeroInfoFlag.REV_KNOWN : 0)
    );
  }

  private nack(opcode: number, reason: number): Uint8Array {
    return Uint8Array.of(TriareOpcode.NACK, opcode, reason);
  }

  /** Mirrors the firmware: physiotherapy commands answer with a NACK when refused. */
  private handleResistCommand(frame: Uint8Array): Uint8Array | Uint8Array[] | null {
    const opcode = frame[0];
    const ack = Uint8Array.of(TriareOpcode.ACK, opcode);
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    switch (opcode) {
      case TriareOpcode.RESIST_MODE: {
        if (frame.length < 2) return this.nack(opcode, NackReason.INVALID_VALUE);
        if (!this.systemEnabled) return this.nack(opcode, NackReason.NOT_ARMED);
        const mode = frame[1];
        if (mode === ResistMode.BRAKE) return this.nack(opcode, NackReason.NO_REGEN_PATH);
        if (mode !== ResistMode.NONE && mode !== ResistMode.ASSIST_VALLEY) {
          return this.nack(opcode, NackReason.INVALID_VALUE);
        }
        this.resistMode = mode;
        if (mode === ResistMode.NONE) this.holdCurrentA = null;
        return ack;
      }
      case TriareOpcode.RESIST_ZONE: {
        if (frame.length < 16) return this.nack(opcode, NackReason.INVALID_VALUE);
        const index = frame[1];
        const startDeg = view.getFloat32(2, true);
        const endDeg = view.getFloat32(6, true);
        const type = frame[10];
        const valuePercent = view.getFloat32(11, true);
        const edgeDeg = frame[15];
        let span = endDeg - startDeg;
        if (span < 0) span += 360;
        const valid =
          index < RESIST_MAX_ZONES &&
          startDeg >= 0 && startDeg <= 360 && endDeg >= 0 && endDeg <= 360 &&
          span >= 1 && valuePercent >= 0 && valuePercent <= 100 &&
          edgeDeg <= RESIST_MAX_EDGE_DEG;
        if (!valid || type !== 0) return this.nack(opcode, type === 1 ? NackReason.NO_REGEN_PATH : NackReason.INVALID_VALUE);
        this.stagedZones = this.stagedZones.filter((z) => z.index !== index);
        this.stagedZones.push({ index, startDeg, endDeg, type, valuePercent, edgeDeg });
        return ack;
      }
      case TriareOpcode.RESIST_COMMIT:
        this.activeZones = [...this.stagedZones].sort((a, b) => a.index - b.index);
        return ack;
      case TriareOpcode.RESIST_CLEAR:
        this.stagedZones = [];
        this.activeZones = [];
        return ack;
      case TriareOpcode.HOLD_ENGAGE: {
        if (!this.systemEnabled) return this.nack(opcode, NackReason.NOT_ARMED);
        const amps = frame.length >= 5 ? view.getFloat32(1, true) : NaN;
        if (!(amps > 0 && amps <= HOLD_MAX_CURRENT_A) || this.gearRatio < HOLD_MIN_GEAR_RATIO) {
          return this.nack(opcode, NackReason.INVALID_VALUE);
        }
        this.resistMode = ResistMode.HOLD;
        this.holdCurrentA = amps;
        return ack;
      }
      case TriareOpcode.HOLD_RELEASE:
        this.resistMode = ResistMode.NONE;
        this.holdCurrentA = null;
        return ack;
      case TriareOpcode.RESIST_TUNE: {
        if (frame.length < 17) return this.nack(opcode, NackReason.INVALID_VALUE);
        const gains = [1, 5, 9, 13].map((o) => view.getFloat32(o, true));
        if (!gains.every((g) => Number.isFinite(g) && g >= 0)) return this.nack(opcode, NackReason.INVALID_VALUE);
        this.resistGains = gains;
        return ack;
      }
      case TriareOpcode.RESIST_GET: {
        if (this.activeZones.length === 0) return Uint8Array.of(opcode, 0xff, 0);
        return this.activeZones.map((z) => {
          const out = new Uint8Array(17);
          const v = new DataView(out.buffer);
          out[0] = opcode;
          out[1] = z.index;
          out[2] = this.activeZones.length;
          v.setFloat32(3, z.startDeg, true);
          v.setFloat32(7, z.endDeg, true);
          out[11] = z.type;
          v.setFloat32(12, z.valuePercent, true);
          out[16] = z.edgeDeg;
          return out;
        });
      }
      default:
        return null;
    }
  }

  private handleCommand(frame: Uint8Array): Uint8Array | Uint8Array[] | null {
    const opcode = frame[0];
    if (opcode >= TriareOpcode.RESIST_MODE && opcode <= TriareOpcode.RESIST_TUNE) {
      return this.supportsResistance ? this.handleResistCommand(frame) : null;
    }
    switch (opcode) {
      case TriareOpcode.STREAM:
        if (!this.supportsStream) return null;
        this.streaming = frame[1] === 1;
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.GET_DEVEUI: {
        const resp = new Uint8Array(1 + this.devEui.length);
        resp[0] = opcode;
        resp.set(this.devEui, 1);
        return resp;
      }
      case TriareOpcode.ECHO: {
        return frame;
      }
      case TriareOpcode.SYSTEM_ENABLE:
        this.systemEnabled = true;
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.SYSTEM_DISABLE:
        this.systemEnabled = false;
        if (this.zeroSearching) this.endZeroSearch(ZeroSearchState.ABORTED);
        this.resistMode = ResistMode.NONE;
        this.holdCurrentA = null;
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.SET_RPM:
        this.lastTargetErpm = this.readFloat32(frame);
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.SET_DUTY:
        this.lastTargetDuty = this.readFloat32(frame);
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.STOP:
        this.lastTargetErpm = null;
        this.lastTargetDuty = null;
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.CALIBRATE_CRANK:
        this.telemetry = { ...this.telemetry, crankAngleDeg: 0 };
        // Always ACKs, but the learning only arms when the ratio was sent in this boot.
        if (this.supportsZero && this.zeroRatioSet) {
          this.zeroLearning = true;
          this.zeroIndexKnown = false;
          this.zeroValid = false;
        }
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.SET_GEAR_RATIO: {
        const ratio = this.readFloat32(frame);
        if (!(ratio > 0) || !Number.isFinite(ratio)) {
          // Mirrors real firmware: invalid value gets no response at all.
          return null;
        }
        // Same-ratio SET_GEAR_RATIO is a no-op on the board: it does not reset the zero.
        if (ratio !== this.gearRatio || !this.zeroRatioSet) {
          this.gearRatio = ratio;
          this.zeroRatioSet = true;
          this.zeroValid = false;
          this.zeroRevKnown = false;
          this.telemetry = { ...this.telemetry, crankAngleDeg: 0 };
        }
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      }

      case TriareOpcode.ZERO_SEARCH: {
        if (!this.supportsZero) return null;
        if (frame[1] === 0) {
          if (this.zeroSearching) this.endZeroSearch(ZeroSearchState.ABORTED);
          return Uint8Array.of(TriareOpcode.ACK, opcode);
        }
        if (!this.systemEnabled) return this.nack(opcode, NackReason.NOT_ARMED);
        if (!this.zeroRatioSet || !this.zeroIndexKnown) return this.nack(opcode, NackReason.ZERO_SETUP);
        this.zeroSearching = true;
        this.zeroValid = false;
        this.zeroSearchState = ZeroSearchState.RUNNING;
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      }

      case TriareOpcode.ZERO_GET: {
        if (!this.supportsZero) return null;
        const resp = new Uint8Array(15);
        const view = new DataView(resp.buffer);
        resp[0] = opcode;
        resp[1] = this.zeroFlags();
        resp[2] = this.zeroSearchState;
        view.setFloat32(3, this.zeroIndexAngleDeg, true);
        view.setFloat32(7, this.zeroLastDriftDeg, true);
        view.setUint16(11, this.zeroPulses, true);
        view.setUint16(13, this.zeroSlips, true);
        return resp;
      }

      case TriareOpcode.REQ_TELEMETRY: {
        const resp = new Uint8Array(22);
        const view = new DataView(resp.buffer);
        resp[0] = opcode;
        view.setFloat32(1, this.telemetry.rpm, true);
        view.setFloat32(5, this.telemetry.current, true);
        view.setFloat32(9, this.telemetry.voltage, true);
        view.setFloat32(13, this.telemetry.temp, true);
        view.setFloat32(17, this.telemetry.crankAngleDeg, true);
        resp[21] = this.telemetry.fault;
        return resp;
      }
      default:
        // Unknown opcode: real firmware behavior is undocumented; stay silent.
        return null;
    }
  }

  private readFloat32(frame: Uint8Array): number {
    return new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getFloat32(1, true);
  }
}
