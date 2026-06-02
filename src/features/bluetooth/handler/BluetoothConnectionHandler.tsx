import { BleManager, Device } from "react-native-ble-plx";
import { requestBluetoothPermissions } from "../requestBluetoothPermission";
import { IBluetoothConnectionHandler } from "./IBluetoothConnectionHandler";

/**
 * Concrete BLE handler for scanning and connecting to TRIARE devices.
 *
 * Wraps `react-native-ble-plx` and filters the raw BLE advertisement stream
 * so only TRIARE-compatible devices are surfaced. Implemented as a singleton
 * because `BleManager` must not be instantiated more than once per application
 * lifecycle (the native adapter does not support multiple concurrent managers).
 *
 * This class must not contain UI or navigation logic.
 */
export class BluetoothConnectionHandler implements IBluetoothConnectionHandler {

    private static instance: BluetoothConnectionHandler;
    private bleManager: BleManager;

    constructor(bleManager: BleManager = new BleManager()) {
        this.bleManager = bleManager;
    }

    /**
     * Returns the shared `BluetoothConnectionHandler` instance, creating it on
     * the first call.
     *
     * Pass a custom `bleManager` only during testing; production code should
     * rely on the default.
     */
    static getInstance(bleManager?: BleManager): BluetoothConnectionHandler {
        if (!BluetoothConnectionHandler.instance) {
            BluetoothConnectionHandler.instance = new BluetoothConnectionHandler(bleManager);
        }
        return BluetoothConnectionHandler.instance;
    }

    /**
     * UUID of the primary BLE service exposed by the current TRIARE test board (STM32).
     *
     * This value is specific to the current development firmware.
     * TODO: Confirm the final GATT profile with the firmware team and update this
     * UUID if the service layout changes before production.
     */
    private TRIARE_SERVICE_UUID = "00000000-0000-0000-0000-000000000011";

    /**
     * Returns true if `device` is likely a TRIARE device.
     *
     * A device passes the filter when either condition is met:
     * - its advertised name contains "STM32" or "TRIARE", OR
     * - it advertises the known TRIARE service UUID.
     * Using OR allows detection even when the name is not present in the
     * advertisement packet (name may be truncated or absent on some firmware builds).
     */
    isTriareDevice = (device: Device) => {
        const deviceName = device.name ?? device.localName ?? "";

        const hasExpectedName = deviceName.includes("STM32") || deviceName.includes("TRIARE");

        const advertisesTriareService = device.serviceUUIDs?.includes(this.TRIARE_SERVICE_UUID) ?? false;

        return hasExpectedName || advertisesTriareService;
    }

    /**
     * Starts a BLE scan after verifying that the required permissions are granted.
     *
     * `startDeviceScan` is called with `null` for both the service UUID filter and
     * scan options, meaning all nearby devices are returned by the adapter; TRIARE
     * filtering is applied manually via `isTriareDevice`.
     *
     * The scan runs indefinitely until `stopScan` is called. Callers are responsible
     * for enforcing a scan timeout.
     *
     * @param onDeviceFound - Invoked for each newly discovered TRIARE device.
     * @param onError - Invoked on permission denial or adapter-level scan errors.
     */
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

    /** Stops the active BLE scan. Safe to call when no scan is running. */
    stopScan = () => {
        this.bleManager.stopDeviceScan();
    }

    /**
     * Connects to a BLE device and discovers all its services and characteristics.
     *
     * `discoverAllServicesAndCharacteristics` must complete before any read,
     * write, or notification operation can be performed on the device.
     *
     * @param deviceId - The platform BLE identifier of the target device.
     * @returns The connected `Device` with a fully populated GATT profile.
     * @throws If the connection attempt or discovery fails.
     */
    async connectToDevice(deviceId: string) {
        const device = await this.bleManager.connectToDevice(deviceId);
        await device.discoverAllServicesAndCharacteristics();
        return device;
    }

}

/**
 * Application-wide singleton instance of `BluetoothConnectionHandler`.
 * Import this directly wherever BLE operations are needed rather than calling
 * `getInstance` again, to guarantee a single shared manager.
 */
export const realBluetoothService = BluetoothConnectionHandler.getInstance();