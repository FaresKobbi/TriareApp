import { DEVEUI_CHAR_UUID, RX_CHAR_UUID, TX_CHAR_UUID } from "../constants/bleUUIDs";
import { TriareOpcode } from "../constants/triareProtocol";
import { IBleCharacteristicManager } from "../IBleCharacteristicManager";
import { TelemetryData } from "../protocol/TriareFrames";
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
  /** Every command frame received on the TX characteristic, in order. */
  receivedFrames: Uint8Array[] = [];

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
    if (response) this.notify(response);
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

  private handleCommand(frame: Uint8Array): Uint8Array | null {
    const opcode = frame[0];
    switch (opcode) {
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
        return Uint8Array.of(TriareOpcode.ACK, opcode);
      case TriareOpcode.SET_GEAR_RATIO: {
        const ratio = this.readFloat32(frame);
        if (!(ratio > 0) || !Number.isFinite(ratio)) {
          // Mirrors real firmware: invalid value gets no response at all.
          return null;
        }
        this.gearRatio = ratio;
        this.telemetry = { ...this.telemetry, crankAngleDeg: 0 };
        return Uint8Array.of(TriareOpcode.ACK, opcode);
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
