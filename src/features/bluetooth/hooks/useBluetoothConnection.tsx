import { mapBleDeviceToTriareDeviceDTO, TriareDeviceDTO } from "@/src/models/triareDeviceDTO";
import { useState } from "react";
import { Device } from "react-native-ble-plx";
import { IBluetoothConnectionHandler} from "../handler/IBluetoothConnectionHandler";

/**
 * Represents the lifecycle of a BLE connection attempt.
 *
 * - "idle"       – no operation in progress
 * - "scanning"   – BLE scan is active
 * - "connecting" – a specific device is being connected to
 * - "connected"  – a device is connected and ready
 * - "error"      – the last operation failed; see the `error` field for details
 */
type ConnectionStatus =
    | "idle"
    | "scanning"
    | "connecting"
    | "connected"
    | "error";

/**
 * Manages BLE scanning, device selection, and connection state for the UI layer.
 *
 * Accepts an `IBluetoothConnectionHandler` so it can be tested with a mock
 * without requiring real hardware. The hook de-duplicates discovered devices and
 * maps raw `Device` objects to `TriareDeviceDTO` before exposing them.
 *
 * @param bluetoothService - BLE handler implementation (real or mock).
 * @returns Stateful values and actions for BLE interaction.
 */
export function useBluetoothConnection(bluetoothService: IBluetoothConnectionHandler) {
    /** Raw BLE device objects returned by the adapter, de-duplicated by ID. */
    const [bleDevices, setBleDevices] = useState<Device[]>([]);
    /** The device the user tapped to connect to (before connection completes). */
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    /** The device that is currently connected and has a populated GATT profile. */
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    /** DTO view of all discovered devices, ready to be rendered by the UI. */
    const triareDevicesDTO: TriareDeviceDTO[] = bleDevices.map(mapBleDeviceToTriareDeviceDTO)

    /**
     * Starts a BLE scan and auto-stops it after 10 seconds.
     *
     * Discovered devices are accumulated and de-duplicated by ID; the list is
     * cleared at the beginning of every new scan to remove stale results.
     *
     * TODO: The status check inside the timeout callback captures `status` via
     * closure at the time `startScan` was called, not when the timeout fires.
     * The condition may therefore be stale. Consider a ref to read current status,
     * or have the timeout only call `stopScan` without touching state directly.
     */
    function startScan() {
        setStatus("scanning");
        setError(null);
        setBleDevices([])

        bluetoothService.scanForTriareDevice(
            (newDevice: Device) => {
                setBleDevices((prevDevices) => {
                    const deviceExist = prevDevices.some(d => d.id === newDevice.id);

                    if (deviceExist) return prevDevices;
                    return [...prevDevices, newDevice];

                });
            },
            () => {
                setStatus("error");
                setError("BLE scan failed");
            }
        );
        setTimeout(() => {
            bluetoothService.stopScan();
            if (status === "connecting" || status === "connected") {
                setStatus("idle")
            }
        }, 10000);
    }

    /** Stops an active scan and resets status to idle. */
    function stopScan() {
        bluetoothService.stopScan();
        setStatus("idle");
    };

    /**
     * Connects to a previously discovered device by ID.
     *
     * The device must already be present in the current scan results. After a
     * successful connection, services and characteristics are logged to the console
     * to aid firmware integration — remove this logging once the GATT profile is stable.
     *
     * @param deviceId - The BLE ID of the device to connect to.
     */
    async function connect(deviceId: string) {
        const device = bleDevices.find((currentDevice) => currentDevice.id === deviceId);

        if (!device) {
            setStatus("error");
            setError("Device not found");
            return;
        }

        setSelectedDevice(device);
        setStatus("connecting");
        setError(null);

        try {
            const connected = await bluetoothService.connectToDevice(device.id);
            setConnectedDevice(connected);
            setStatus("connected");

            // Temporary diagnostic logging — helps verify the GATT profile during
            // hardware bringup. Remove once service/characteristic UUIDs are confirmed.
            const services = await connected.services();
            console.log(`[BLE] Connected to ${connected.name ?? connected.id}`);
            console.log(`[BLE] Found ${services.length} service(s)`);
            for (const service of services) {
                console.log(`[BLE]   Service: ${service.uuid}`);
                const characteristics = await service.characteristics();
                for (const char of characteristics) {
                    console.log(`[BLE]     Characteristic: ${char.uuid} | readable: ${char.isReadable} | writable: ${char.isWritableWithResponse || char.isWritableWithoutResponse} | notifiable: ${char.isNotifiable}`);
                }
            }
        } catch {
            setStatus("error");
            setError("Unable to connect to device");
        }
    }

    return {
        triareDevicesDTO,
        selectedDevice: selectedDevice
            ? mapBleDeviceToTriareDeviceDTO(selectedDevice)
            : null,
        connectedDevice: connectedDevice
            ? mapBleDeviceToTriareDeviceDTO(connectedDevice)
            : null,
        status,
        error,
        startScan,
        stopScan,
        connect,
    };

}