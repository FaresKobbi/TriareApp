import { Device } from "react-native-ble-plx";

/**
 * UI-facing representation of a discovered TRIARE device.
 *
 * This is a simplified projection of the raw BLE `Device` object. Fields that
 * are not yet available from the firmware are typed as `null` and will be
 * populated once the corresponding characteristics are implemented.
 */
export type TriareDeviceDTO = {
    id: string;
    name: string | null;
    /**
     * Battery level as a percentage (0–100).
     * Currently always `null` — the battery characteristic has not been
     * implemented in the firmware yet.
     * TODO: Read from the standard BLE Battery Service (UUID 0x180F) once available.
     */
    battery: number | null;
    /** Signal strength in dBm. Negative values closer to 0 indicate a stronger signal. */
    rssi: number | null;
}

/**
 * Maps a raw `react-native-ble-plx` `Device` to a `TriareDeviceDTO`.
 *
 * Falls back to `localName` when the primary `name` field is absent, which
 * can happen if the advertisement packet does not include a complete local name.
 *
 * @param device - The raw BLE device returned by the adapter.
 * @returns A `TriareDeviceDTO` suitable for display in the UI.
 */
export function mapBleDeviceToTriareDeviceDTO(device:Device): TriareDeviceDTO{
    return{
        id: device.id,
        name: device.name ?? device.localName ?? "UNKNOWN",
        // Battery is not yet readable from the device; hardcoded to null until
        // the firmware exposes a battery characteristic.
        battery: null,
        rssi: device.rssi ?? null
    };
}