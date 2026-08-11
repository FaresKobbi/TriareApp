import { BleError, Device, Subscription } from "react-native-ble-plx";
import { IBleCharacteristicManager } from "./IBleCharacteristicManager";

export class BleCharacteristicManager implements IBleCharacteristicManager {
  private device: Device;
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionCounter = 0;

  constructor(device: Device) {
    this.device = device;
  }

  async write(serviceUUID: string, charUUID: string, value: string) {
    await this.device.writeCharacteristicWithResponseForService(
      serviceUUID, charUUID, value
    );
  }

  /** The TRIARE protocol writes command frames without response. */
  async writeWithoutResponse(serviceUUID: string, charUUID: string, value: string) {
    await this.device.writeCharacteristicWithoutResponseForService(
      serviceUUID, charUUID, value
    );
  }

  async read(serviceUUID: string, charUUID: string): Promise<string | null> {
  const characteristic = await this.device.readCharacteristicForService(
    serviceUUID,
    charUUID
    );
        return characteristic.value; // base64 encoded
    }

  subscribe(
    serviceUUID: string,
    charUUID: string,
    onData: (value: string) => void,
    onError?: (error: BleError) => void
  ): () => void {
    const subscription = this.device.monitorCharacteristicForService(
      serviceUUID,
      charUUID,
      (error, characteristic) => {
        if (error) { onError?.(error); return; }
        if (characteristic?.value) onData(characteristic.value);
      }
    );
    // Counter keeps keys unique so two subscribers to the same characteristic
    // don't evict each other from cleanup tracking.
    const key = `${serviceUUID}:${charUUID}:${this.subscriptionCounter++}`;
    this.subscriptions.set(key, subscription);

    // Returns an unsubscribe function
    return () => {
      subscription.remove();
      this.subscriptions.delete(key);
    };
  }

  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions.clear();
  }
}