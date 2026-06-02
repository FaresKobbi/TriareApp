import { Device } from "react-native-ble-plx";

export type ScanDeviceCallback = (device: Device) => void;
export type ScanErrorCallback = () => void;

export interface IBluetoothConnectionHandler {
  scanForTriareDevice(
    onDeviceFound: ScanDeviceCallback,
    onError: ScanErrorCallback
  ): void;

  stopScan(): void;

  connectToDevice(deviceId: string): Promise<Device>;
}