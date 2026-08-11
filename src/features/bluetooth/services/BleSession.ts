import { Device } from "react-native-ble-plx";
import { BleCharacteristicManager } from "../BleCharacteristicManager";
import { TriareVescCodec } from "../protocol/TriareVescCodec";
import { BasicCommunicationService } from "./BasicCommunicationService";
import { TriareCommandService } from "./TriareCommandService";

/**
 * Aggregates the services for one BLE connection. Composition root for the
 * protocol stack: this is the only place concrete implementations
 * (characteristic manager, codec) are wired together.
 */
export class BleSession {
  readonly characteristicManager: BleCharacteristicManager;
  readonly basicCommunication: BasicCommunicationService;
  /** Typed TRIARE command channel — use this for motor control. */
  readonly commands: TriareCommandService;

  constructor(device: Device) {
    this.characteristicManager = new BleCharacteristicManager(device);
    this.basicCommunication = new BasicCommunicationService(this.characteristicManager);
    this.commands = new TriareCommandService(this.characteristicManager, new TriareVescCodec());
  }

  /** Releases all subscriptions. Call when the connection ends. */
  dispose(): void {
    this.commands.dispose();
    this.characteristicManager.unsubscribeAll();
  }
}
