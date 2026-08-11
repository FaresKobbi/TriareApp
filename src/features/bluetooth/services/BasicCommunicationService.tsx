import {
  DEVEUI_CHAR_UUID,
  RX_CHAR_UUID,
  TRIARE_SERVICE_UUID,
  TX_CHAR_UUID,
} from "../constants/bleUUIDs";
import { IBleCharacteristicManager } from "../IBleCharacteristicManager";
import { base64ToBytes, bytesToBase64 } from "../utils/base64";

/**
 * Raw byte-level access to the TRIARE characteristics — diagnostic layer.
 *
 * Application commands should go through `TriareCommandService`, which adds
 * protocol framing, response matching and timeouts on top of the same
 * characteristics.
 */
export class BasicCommunicationService {
  constructor(private manager: IBleCharacteristicManager) {}

  /** Reads the only readable characteristic: the 8-byte DevEUI. */
  async readValue(): Promise<Uint8Array> {
    const b64 = await this.manager.read(TRIARE_SERVICE_UUID, DEVEUI_CHAR_UUID);
    return b64 ? base64ToBytes(b64) : new Uint8Array(0);
  }

  /** Writes raw bytes to the TX characteristic (write without response, per protocol). */
  async writeValue(bytes: Uint8Array): Promise<void> {
    const b64 = bytesToBase64(bytes);
    await this.manager.writeWithoutResponse(TRIARE_SERVICE_UUID, TX_CHAR_UUID, b64);
  }

  subscribeToNotifications(onData: (bytes: Uint8Array) => void): () => void {
    return this.manager.subscribe(
      TRIARE_SERVICE_UUID,
      RX_CHAR_UUID,
      (b64) => onData(base64ToBytes(b64)),
    );
  }
}
