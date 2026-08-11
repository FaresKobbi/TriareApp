import { BleCharacteristicManager } from "../BleCharacteristicManager";
import {
  NOTIFY_CHAR_UUID,
  READ_CHAR_UUID,
  TRIARE_SERVICE_UUID,
  WRITE_CHAR_UUID,
} from "../constants/bleUUIDs";

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array([...atob(b64)].map((c) => c.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export class BasicCommunicationService {
  constructor(private manager: BleCharacteristicManager) {}

  async readValue(): Promise<Uint8Array> {
    const b64 = await this.manager.read(TRIARE_SERVICE_UUID, READ_CHAR_UUID);
    return b64 ? base64ToBytes(b64) : new Uint8Array(0);
  }

  async writeValue(bytes: Uint8Array): Promise<void> {
    const b64 = bytesToBase64(bytes);
    await this.manager.write(TRIARE_SERVICE_UUID, WRITE_CHAR_UUID, b64);
  }

  subscribeToNotifications(onData: (bytes: Uint8Array) => void): () => void {
    return this.manager.subscribe(
      TRIARE_SERVICE_UUID,
      NOTIFY_CHAR_UUID,
      (b64) => onData(base64ToBytes(b64)),
    );
  }
}
