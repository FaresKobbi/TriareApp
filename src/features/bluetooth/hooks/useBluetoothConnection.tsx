import { t } from "@/src/i18n";
import { mapBleDeviceToTriareDeviceDTO, TriareDeviceDTO } from "@/src/models/triareDeviceDTO";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "react-native-ble-plx";
import { useBleSessionContext } from "../context/BleSessionContext";
import { IBluetoothConnectionHandler} from "../handler/IBluetoothConnectionHandler";
import { BleSession } from "../services/BleSession";

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
 * Logs the GATT profile to the console to aid firmware integration.
 * Diagnostic only — a failure here must never affect the connection.
 */
async function logGattProfile(device: Device): Promise<void> {
    const services = await device.services();
    console.log(`[BLE] Connected to ${device.name ?? device.id}`);
    console.log(`[BLE] Found ${services.length} service(s)`);
    for (const service of services) {
        console.log(`[BLE]   Service: ${service.uuid}`);
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
            console.log(`[BLE]     Characteristic: ${char.uuid} | readable: ${char.isReadable} | writable: ${char.isWritableWithResponse || char.isWritableWithoutResponse} | notifiable: ${char.isNotifiable}`);
        }
    }
}

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

    const router = useRouter();
    const { setSession } = useBleSessionContext();

    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Guards against a second connect() (double tap) while one is in flight. */
    const isConnectingRef = useRef(false);

    const clearScanTimeout = useCallback(() => {
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
    }, []);

    // Leaving the screen must not leave a scan running or a timer pending.
    useEffect(() => () => {
        clearScanTimeout();
        bluetoothService.stopScan();
    }, [bluetoothService, clearScanTimeout]);

    /** DTO view of all discovered devices, ready to be rendered by the UI. */
    const triareDevicesDTO: TriareDeviceDTO[] = bleDevices.map(mapBleDeviceToTriareDeviceDTO)

    /**
     * Starts a BLE scan and auto-stops it after 10 seconds.
     *
     * Discovered devices are accumulated and de-duplicated by ID; the list is
     * cleared at the beginning of every new scan to remove stale results.
     *
     * Only one scan timer exists at a time: starting a new scan cancels the
     * previous timer, so an old timeout can no longer cut the new scan short.
     * When the timer fires, status goes back to "idle" only if it is still
     * "scanning" — a connection that started meanwhile keeps its status.
     */
    function startScan() {
        clearScanTimeout();
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
                setError(t("connection.scanFailed"));
            }
        );
        scanTimeoutRef.current = setTimeout(() => {
            scanTimeoutRef.current = null;
            bluetoothService.stopScan();
            setStatus((current) => (current === "scanning" ? "idle" : current));
        }, 10000);
    }

    /** Stops an active scan and resets status to idle. */
    function stopScan() {
        clearScanTimeout();
        bluetoothService.stopScan();
        setStatus("idle");
    };

    /**
     * Connects to a previously discovered device by ID.
     *
     * The device must already be present in the current scan results. The scan
     * is stopped first (connecting while scanning is slow and unreliable on
     * Android). After a successful connection, services and characteristics are
     * logged to the console to aid firmware integration — remove this logging
     * once the GATT profile is stable.
     *
     * @param deviceId - The BLE ID of the device to connect to.
     */
    async function connect(deviceId: string) {
        if (isConnectingRef.current) return;

        const device = bleDevices.find((currentDevice) => currentDevice.id === deviceId);

        if (!device) {
            setStatus("error");
            setError(t("connection.deviceNotFound"));
            return;
        }

        isConnectingRef.current = true;
        clearScanTimeout();
        bluetoothService.stopScan();
        setSelectedDevice(device);
        setStatus("connecting");
        setError(null);

        try {
            const connected = await bluetoothService.connectToDevice(device.id);
            setConnectedDevice(connected);
            setStatus("connected");

            const session = new BleSession(connected);
            setSession(session);
            router.replace("/(tabs)/speed");

            // Temporary diagnostic logging — remove once the GATT profile is stable.
            logGattProfile(connected).catch((e) => console.warn("[BLE] GATT dump failed", e));
        } catch (e) {
            console.warn("[BLE] connect failed", e);
            // Never leave the board holding a half-open link: it would stop
            // advertising and could only be reached again after a reset.
            await bluetoothService.disconnectDevice(device.id);
            setStatus("error");
            setError(t("connection.connectFailed"));
        } finally {
            isConnectingRef.current = false;
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