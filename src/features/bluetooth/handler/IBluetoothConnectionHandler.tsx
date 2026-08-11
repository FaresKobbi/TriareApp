import { Device } from "react-native-ble-plx";

/** Called each time a compatible TRIARE device is discovered during a scan. */
export type ScanDeviceCallback = (device: Device) => void;

/** Called when a BLE scan fails, e.g. due to permission denial or adapter error. */
export type ScanErrorCallback = () => void;

/**
 * Contract for BLE scanning and connection operations targeting TRIARE devices.
 *
 * Implementations are responsible for filtering discovered devices, managing the
 * BLE adapter lifecycle, and establishing a connection.
 * UI logic must not live here.
 */
export interface IBluetoothConnectionHandler {
  /**
   * Starts a BLE scan and delivers compatible TRIARE devices to the caller.
   *
   * Bluetooth permissions must be granted before this is called.
   * The scan does not stop automatically; call `stopScan` when done.
   *
   * @param onDeviceFound - Invoked each time a new TRIARE device is discovered.
   * @param onError - Invoked if the scan cannot be started or encounters a fatal error.
   */
  scanForTriareDevice(
    onDeviceFound: ScanDeviceCallback,
    onError: ScanErrorCallback
  ): void;

  /**
   * Stops an active BLE scan.
   * Safe to call even if no scan is in progress.
   */
  stopScan(): void;

  /**
   * Connects to the device with the given BLE ID and discovers its services and
   * characteristics so they are ready to be read or written.
   *
   * @param deviceId - The platform-level BLE identifier returned by `react-native-ble-plx`.
   * @returns The connected `Device` object with a fully populated GATT profile.
   * @throws If the connection or discovery step fails.
   */
  connectToDevice(deviceId: string): Promise<Device>;
}