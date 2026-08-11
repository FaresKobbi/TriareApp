/**
 * Contract for low-level GATT operations on a connected device.
 *
 * Values are base64-encoded strings at this layer, matching what
 * `react-native-ble-plx` exposes. Implementations: `BleCharacteristicManager`
 * (real device) and `MockBleCharacteristicManager` (in-memory firmware
 * simulator for offline development and integration tests).
 *
 * Deliberately free of `react-native-ble-plx` imports so mocks and tests can
 * depend on it without pulling in the native module.
 */
export interface IBleCharacteristicManager {
  /** Write with response (GATT-level confirmation). */
  write(serviceUUID: string, charUUID: string, value: string): Promise<void>;

  /**
   * Write without response — the mode the TRIARE protocol uses for command
   * frames; delivery feedback comes from the application-level notification.
   */
  writeWithoutResponse(serviceUUID: string, charUUID: string, value: string): Promise<void>;

  read(serviceUUID: string, charUUID: string): Promise<string | null>;

  /** Subscribes to notifications. Returns an unsubscribe function. */
  subscribe(
    serviceUUID: string,
    charUUID: string,
    onData: (value: string) => void,
    onError?: (error: Error) => void
  ): () => void;

  unsubscribeAll(): void;
}
