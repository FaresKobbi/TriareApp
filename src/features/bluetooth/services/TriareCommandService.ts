import {
  DEVEUI_CHAR_UUID,
  RX_CHAR_UUID,
  TRIARE_SERVICE_UUID,
  TX_CHAR_UUID,
} from "../constants/bleUUIDs";
import { ACK_TIMEOUT_MS, nackReasonName } from "../constants/triareProtocol";
import { IBleCharacteristicManager } from "../IBleCharacteristicManager";
import { CommandCodec, ResistGains, ResistZoneInput } from "../protocol/CommandCodec";
import { DecodedFrame, ResistanceData, ResistZone, TelemetryData } from "../protocol/TriareFrames";
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
 * The firmware answered with a NACK: it received the command and refused it
 * (disarmed, emergency stop, fault, invalid value). Unlike a timeout the
 * outcome is known — the command was NOT applied — and `reason` says why.
 */
export class CommandRejectedError extends Error {
  constructor(readonly opcode: number, readonly reason: number) {
    super(
      `Command 0x${opcode.toString(16).padStart(2, "0").toUpperCase()} rejected by the firmware` +
        ` (${nackReasonName(reason)})`
    );
    this.name = "CommandRejectedError";
  }
}

/**
 * The device responded, but not with the frame the command expects. The
 * decoded frame is attached for diagnosis.
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
  private statusListeners = new Set<(status: number) => void>();
  private streamListeners = new Set<(sample: TelemetryData) => void>();
  private resistanceListeners = new Set<(sample: ResistanceData) => void>();
  private unsubscribe: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private manager: IBleCharacteristicManager,
    private codec: CommandCodec,
    private timeoutMs: number = ACK_TIMEOUT_MS,
  ) {}

  /**
   * Starts listening to the device now instead of at the first command, so a
   * state change the board announces right after the connection is not missed.
   */
  start(): void {
    this.ensureSubscribed();
  }

  /**
   * Registers a listener for the board's unsolicited state notifications
   * (`TelemetryStatus` bits). Returns the function that removes it. Calls
   * `start()`. Firmware without this feature simply never calls it.
   */
  onStatus(listener: (status: number) => void): () => void {
    this.statusListeners.add(listener);
    this.ensureSubscribed();
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Registers a listener for the resistance samples the board pushes (with the
   * telemetry stream) while a physiotherapy mode is active. Returns the
   * function that removes it. Calls `start()`.
   */
  onResistance(listener: (sample: ResistanceData) => void): () => void {
    this.resistanceListeners.add(listener);
    this.ensureSubscribed();
    return () => {
      this.resistanceListeners.delete(listener);
    };
  }

  /**
   * Asks the board to push telemetry (20 Hz) and delivers every sample to
   * `listener`. Resolves with the function that stops the stream once the board
   * has acknowledged; rejects if it did not (firmware without streaming stays
   * silent → `AckTimeoutError`), in which case the caller should poll instead.
   * The board stops streaming by itself when the link drops.
   */
  async startStream(listener: (sample: TelemetryData) => void): Promise<() => void> {
    this.streamListeners.add(listener);
    try {
      await this.sendExpectingAck(this.codec.encodeStream(true));
    } catch (e) {
      this.streamListeners.delete(listener);
      throw e;
    }
    return () => {
      this.streamListeners.delete(listener);
      if (this.streamListeners.size === 0) {
        // Best effort: if it fails the stream ends with the link anyway.
        this.sendExpectingAck(this.codec.encodeStream(false)).catch(() => {});
      }
    };
  }

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

  /** Zeroes the crank angle at the current pedal position. */
  async calibrateCrank(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeCalibrateCrank());
  }

  /**
   * Sets the gear ratio (crank teeth ÷ motor teeth). Must be > 0 and finite.
   * Also re-zeroes the crank angle on success, same as calibrateCrank().
   * An invalid value is refused with a NACK (CommandRejectedError); older
   * firmware stays silent instead, which surfaces as AckTimeoutError.
   */
  async setGearRatio(ratio: number): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeSetGearRatio(ratio));
  }


  // --- Physiotherapy (torque) modes ----------------------------------------

  /**
   * Starts (1) or ends (0) the assist-valley mode. Needs the system armed. Mode 2
   * (brake) is refused by the board while it has no energy return path
   * (CommandRejectedError, reason NO_REGEN_PATH).
   */
  async setResistMode(mode: number): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeResistMode(mode));
  }

  /** Stages one zone on the board. Takes effect only after `commitResistZones()`. */
  async stageResistZone(zone: ResistZoneInput): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeResistZone(zone));
  }

  /** Publishes the staged zones all at once. */
  async commitResistZones(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeResistCommit());
  }

  /** Clears the staged and the active zones. */
  async clearResistZones(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeResistClear());
  }

  /**
   * Replaces the board's zones with `zones`: clear, stage each, commit. The board
   * only switches at the commit, so a failure half-way leaves the old zones in
   * force (the staged draft is discarded by the next clear).
   */
  async applyResistZones(zones: ResistZoneInput[]): Promise<void> {
    await this.clearResistZones();
    for (const zone of zones) {
      await this.stageResistZone(zone);
    }
    await this.commitResistZones();
  }

  /** Reads the zones currently active on the board. */
  async getResistZones(): Promise<ResistZone[]> {
    const request = this.codec.encodeResistGet();
    const frames = await this.sendCollecting(request, (collected) => {
      const first = collected[0];
      if (first.kind !== "resistZone") return true;
      return collected.length >= first.total;
    });
    const zones: ResistZone[] = [];
    for (const frame of frames) {
      if (frame.kind !== "resistZone") {
        throw new UnexpectedFrameError(request[0], frame);
      }
      if (frame.zone) zones.push(frame.zone);
    }
    return zones.sort((a, b) => a.index - b.index);
  }

  /**
   * Static hold (mode C): once the pedal is nearly still the board holds its
   * position with up to `amps`. Needs the system armed and a gear ratio of at
   * least HOLD_MIN_GEAR_RATIO. It yields if the pedal is forced and never brakes.
   */
  async engageHold(amps: number): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeHoldEngage(amps));
  }

  /** Releases the hold (or the active mode) with a short ramp. */
  async releaseHold(): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeHoldRelease());
  }

  /** Adjusts the controller gains (bench tuning). The board refuses unsafe values. */
  async tuneResist(gains: ResistGains): Promise<void> {
    await this.sendExpectingAck(this.codec.encodeResistTune(gains));
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
    this.statusListeners.clear();
    this.streamListeners.clear();
    this.resistanceListeners.clear();
  }

  private ensureSubscribed(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.manager.subscribe(TRIARE_SERVICE_UUID, RX_CHAR_UUID, (b64) => {
      const frame = this.codec.decode(base64ToBytes(b64));
      // State notifications are unsolicited and have an opcode of their own,
      // so they can never be mistaken for the reply to a command in flight.
      if (frame.kind === "status") {
        this.statusListeners.forEach((listener) => listener(frame.status));
        return;
      }
      if (frame.kind === "stream") {
        this.streamListeners.forEach((listener) => listener(frame.telemetry));
        return;
      }
      if (frame.kind === "resistance") {
        this.resistanceListeners.forEach((listener) => listener(frame.resistance));
        return;
      }
      // Any other frame with no command in flight is unexpected and dropped.
      this.pendingResolve?.(frame);
    });
  }

  private async sendExpectingAck(request: Uint8Array): Promise<void> {
    const frame = await this.send(request);
    if (frame.kind === "nack" && frame.rejectedOpcode === request[0]) {
      throw new CommandRejectedError(request[0], frame.reason);
    }
    if (frame.kind !== "ack" || frame.ackedOpcode !== request[0]) {
      throw new UnexpectedFrameError(request[0], frame);
    }
  }

  /**
   * Like `send`, for commands answered by several notifications (RESIST_GET).
   * Keeps collecting frames until `isComplete(frames)` is true; the timeout
   * applies to each frame. A NACK ends it with CommandRejectedError.
   */
  private sendCollecting(
    request: Uint8Array,
    isComplete: (frames: DecodedFrame[]) => boolean,
  ): Promise<DecodedFrame[]> {
    const run = (): Promise<DecodedFrame[]> => {
      this.ensureSubscribed();
      return new Promise<DecodedFrame[]>((resolve, reject) => {
        const frames: DecodedFrame[] = [];
        let timer: ReturnType<typeof setTimeout>;
        const fail = (error: Error) => {
          clearTimeout(timer);
          this.pendingResolve = null;
          reject(error);
        };
        const arm = () => {
          clearTimeout(timer);
          timer = setTimeout(() => fail(new AckTimeoutError(request[0])), this.timeoutMs);
        };

        this.pendingResolve = (frame) => {
          if (frame.kind === "nack" && frame.rejectedOpcode === request[0]) {
            fail(new CommandRejectedError(request[0], frame.reason));
            return;
          }
          frames.push(frame);
          if (isComplete(frames)) {
            clearTimeout(timer);
            this.pendingResolve = null;
            resolve(frames);
            return;
          }
          arm();
        };

        arm();
        this.manager
          .writeWithoutResponse(TRIARE_SERVICE_UUID, TX_CHAR_UUID, bytesToBase64(request))
          .catch((err) => fail(err instanceof Error ? err : new Error(String(err))));
      });
    };

    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
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
