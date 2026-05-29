import { BleManager, Device } from "react-native-ble-plx";
import { IBluetoothService } from "./IBluetoothService";
import { requestBluetoothPermissions } from "./requestBluetoothPermission";

export class BluetoothService implements IBluetoothService {
    private bleManager: BleManager;

    constructor(bleManager: BleManager = new BleManager()) {
        this.bleManager = bleManager;
    }
    private TRIARE_SERVICE_UUID = "00000000-0000-0000-0000-000000000011";

    isTriareDevice = (device: Device) => {
        const deviceName = device.name ?? device.localName ?? "";

        const hasExpectedName = deviceName.includes("STM32") || deviceName.includes("TRIARE");

        const advertisesTriareService = device.serviceUUIDs?.includes(this.TRIARE_SERVICE_UUID) ?? false;

        return hasExpectedName || advertisesTriareService;
    }



    scanForTriareDevice = async (onDeviceFound: (device: Device) => void, onError?: () => void) => {
        try {
            const permissionResult = await requestBluetoothPermissions();

            if (!permissionResult) {
                return;
            }

            this.bleManager.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    console.warn("BLE scan error", error.message);
                    onError?.();
                    return;
                }
                console.log(device)
                if (device && this.isTriareDevice(device)) {
                    onDeviceFound(device);
                }
            });
        } catch (error) {
            console.warn("Error during BLE scan", error);
            onError?.();
        }
    }

    stopScan = () => {
        this.bleManager.stopDeviceScan();
    }

    async connectToDevice(deviceId: string) {
        const device = await this.bleManager.connectToDevice(deviceId);
        await device.discoverAllServicesAndCharacteristics();
        return device;
    }

}


export const realBluetoothService = new BluetoothService();