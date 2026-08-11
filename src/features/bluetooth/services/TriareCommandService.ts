import {
  DEVEUI_CHAR_UUID,
  RX_CHAR_UUID,
  TRIARE_SERVICE_UUID,
  TX_CHAR_UUID,
} from "../constants/bleUUIDs";
import { ACK_TIMEOUT_MS } from "../constants/triareProtocol";
import { IBleCharacteristicManager } from "../IBleCharacteristicManager";
import { CommandCodec } from "../protocol/CommandCodec";
import { DecodedFrame, TelemetryData } from "../protocol/TriareFrames";
import { base64ToBytes, bytesToBase64 } from "../utils/base64";

/**
 * The device did not notify a response within the timeout window.
 *
 * This is a safety-relevant condition: a command (e.g. STOP) may or may not
 * have been applied. Callers must surface it to the user rather than assume
 * either outcome.
 */
export class AckTimeoutError extends Error {
  constructor(readonly opcode: number) {
    super(`No response for command 0x${opcode.toString(16).padStart(2, "0").toUpperCase()}`);
    this.name = "AckTimeoutError";
  }
}

/**
 * The device responded, but not with the frame the command expects — e.g. a
 * motion command sent while the system is disarmed. The firmware's exact
 * failure-response shape is not documented, so the decoded frame is attached
 * for diagnosis.
 */
export class UnexpectedFrameError extends Error {
  constructor(readonly opcode: number, readonly frame: DecodedFrame) {
    super(
      `Unexpected response to command 0x${opcode.toString(16).padStart(2, "0").toUpperCase()}` +
        ` (got "${frame.kind}" frame). Is the system enabled?`
    );
    this.name = "UnexpectedFrameError";
  }
}

/**
 * Request/response layer for the TRIARE command protocol.
 *
 * Mirrors `TriareBLE.write()` in the reference host script: each command is
 * written without response to the TX characteristic, then the next
 * notification on the RX characteristic is taken as its reply, with a
 * timeout (`ACK_TIMEOUT_MS`). Commands are serialized — one in flight at a
 * time — because the protocol has no correlation IDs.
 */
export class TriareCommandService {
  private pendingResolve: ((frame: DecodedFrame) => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private manager: IBleCharacteristicManager,
    private codec: CommandCodec,
    private timeoutMs: number = ACK_TIMEOUT_MS,
  ) {}

  /** Arms the system. Motor stays freewheeling until SET_RPM / SET_DUTY. */
  async enable(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeSystemEnable());
  }

  /** Disarms the system. */
  async disable(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeSystemDisable());
  }

  /** Freewheels the motor; the system stays armed. */
  async stop(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeStop());
  }

  /** Sets the target electrical RPM. Requires the system to be enabled. */
  async setRpm(erpm: number): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeSetRpm(erpm));
  }

  /** Sets the duty cycle in [-1.0, 1.0]; negative reverses the motor. */
  async setDuty(duty: number): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeSetDuty(duty));
  }

  async requestTelemetry(): Promise<TelemetryData> {
    const request = this.codec.encodeRequestTelemetry();
    const frame = await this.send(request);
    if (frame.kind !== "telemetry") {
      throw new UnexpectedFrameError(request[0], frame);
    }
    return frame.telemetry;
  }

  /** Reads the DevEUI through the command channel (CMD_GET_DEVEUI). */
  async getDevEui(): Promise<Uint8Array> {
    const request = this.codec.encodeGetDevEui();
    const frame = await this.send(request);
    if (frame.kind !== "devEui") {
      throw new UnexpectedFrameError(request[0], frame);
    }
    return frame.devEui;
  }

  /** Reads the DevEUI directly from its read characteristic (no command round-trip). */
  async readDevEui(): Promise<Uint8Array> {
    const b64 = await this.manager.read(TRIARE_SERVICE_UUID, DEVEUI_CHAR_UUID);
    return b64 ? base64ToBytes(b64) : new Uint8Array(0);
  }

  /** Diagnostic loopback. Resolves with the echoed payload. */
  async echo(payload: Uint8Array): Promise<Uint8Array> {
    const request = this.codec.encodeEcho(payload);
    const frame = await this.send(request);
    if (frame.kind !== "echo") {
      throw new UnexpectedFrameError(request[0], frame);
    }
    return frame.payload;
  }

  /** Releases the RX subscription. Call when the session ends. */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pendingResolve = null;
  }

  private ensureSubscribed(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.manager.subscribe(TRIARE_SERVICE_UUID, RX_CHAR_UUID, (b64) => {
      const frame = this.codec.decode(base64ToBytes(b64));
      // Frames arriving with no command in flight are unsolicited; the
      // protocol defines none today, so they are dropped.
      this.pendingResolve?.(frame);
    });
  }

  private async sendExpectingAck(request: Uint8Array): Promise<void> {
    const frame = await this.send(request);
    if (frame.kind !== "ack" || frame.ackedOpcode !== request[0]) {
      throw new UnexpectedFrameError(request[0], frame);
    }
  }

  /** Serialized write-then-wait-for-notification, with timeout. */
  private send(request: Uint8Array): Promise<DecodedFrame> {
    const run = (): Promise<DecodedFrame> => {
      this.ensureSubscribed();
      return new Promise<DecodedFrame>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingResolve = null;
          reject(new AckTimeoutError(request[0]));
        }, this.timeoutMs);

        this.pendingResolve = (frame) => {
          clearTimeout(timer);
          this.pendingResolve = null;
          resolve(frame);
        };

        this.manager
          .writeWithoutResponse(TRIARE_SERVICE_UUID, TX_CHAR_UUID, bytesToBase64(request))
          .catch((err) => {
            clearTimeout(timer);
            this.pendingResolve = null;
            reject(err);
          });
      });
    };

    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}
