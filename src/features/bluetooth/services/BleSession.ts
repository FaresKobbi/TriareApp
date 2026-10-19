import type { ConnectionPriority, Device, Subscription } from "react-native-ble-plx";
import { BleCharacteristicManager } from "../BleCharacteristicManager";
import { TriareVescCodec } from "../protocol/TriareVescCodec";
import { BasicCommunicationService } from "./BasicCommunicationService";
import { TriareCommandService } from "./TriareCommandService";

/**
 * Aggregates the services for one BLE connection. Composition root for the
 * protocol stack: this is the only place concrete implementations
 * (characteristic manager, codec) are wired together.
 *
 * It also owns the lifetime of the link itself: `disconnect()` closes it, and
 * `onLinkLost()` reports a link that dropped without us asking.
 */
export class BleSession {
  readonly characteristicManager: BleCharacteristicManager;
  readonly basicCommunication: BasicCommunicationService;
  /** Typed TRIARE command channel — use this for motor control. */
  readonly commands: TriareCommandService;

  private linkLostSubscription: Subscription | null = null;
  private linkLostListener: (() => void) | null = null;
  private ended = false;

  constructor(private readonly device: Device) {
    this.characteristicManager = new BleCharacteristicManager(device);
    this.basicCommunication = new BasicCommunicationService(this.characteristicManager);
    this.commands = new TriareCommandService(this.characteristicManager, new TriareVescCodec());

    // Fires when the link drops (out of range, board reset, ...). `dispose()`
    // removes it first, so our own disconnect() never reports a "loss".
    // Optional call: lightweight Device test doubles may not implement it.
    this.linkLostSubscription =
      device.onDisconnected?.(() => {
        if (!this.ended) this.linkLostListener?.();
      }) ?? null;
  }

  /** Registers the (single) handler for a link that ends without disconnect(). */
  onLinkLost(listener: (() => void) | null): void {
    this.linkLostListener = listener;
  }

  /**
   * Asks Android for a low-latency link (short connection interval) while
   * `fast` is true, and for the normal balanced one when it is false. Costs
   * battery on both sides, so use it only while someone is watching live data
   * (the pedal dial). No-op on iOS and on a link that is already gone.
   */
  async setFastLink(fast: boolean): Promise<void> {
    if (this.ended) return;
    try {
      // 1 = High, 0 = Balanced (react-native-ble-plx ConnectionPriority).
      await this.device.requestConnectionPriority?.((fast ? 1 : 0) as ConnectionPriority);
    } catch {
      // Not supported here (iOS) or the link dropped: the dial still works.
    }
  }

  /**
   * Ends the session and closes the BLE link, freeing the board to advertise
   * again. Safe to call twice and on a link that is already down.
   */
  async disconnect(): Promise<void> {
    this.dispose();
    try {
      await this.device.cancelConnection();
    } catch {
      // Already disconnected: nothing left to release.
    }
  }

  /**
   * Releases all subscriptions and listeners without touching the link.
   * Prefer `disconnect()`, which calls this and then closes the link.
   */
  dispose(): void {
    this.ended = true;
    this.linkLostSubscription?.remove();
    this.linkLostSubscription = null;
    this.linkLostListener = null;
    this.commands.dispose();
    this.characteristicManager.unsubscribeAll();
  }
}
