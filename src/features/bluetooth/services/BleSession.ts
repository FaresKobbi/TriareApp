import { Device } from "react-native-ble-plx";
import { BleCharacteristicManager } from "../BleCharacteristicManager";
import { BasicCommunicationService } from "./BasicCommunicationService";

export class BleSession {
  readonly characteristicManager: BleCharacteristicManager;
  readonly basicCommunication: BasicCommunicationService;

  constructor(device: Device) {
    this.characteristicManager = new BleCharacteristicManager(device);
    this.basicCommunication = new BasicCommunicationService(this.characteristicManager);
  }
}
