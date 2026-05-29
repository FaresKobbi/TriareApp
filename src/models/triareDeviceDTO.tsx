import { Device } from "react-native-ble-plx";

{/* Mocked Device List, waiting for bluetooth */}
export type TriareDeviceDTO = {
    id: string;
    name: string | null;
    battery: number | null;
    rssi: number | null;
}

export function mapBleDeviceToTriareDeviceDTO(device:Device): TriareDeviceDTO{
    return{
        id: device.id,
        name: device.name ?? device.localName ?? "UNKNOWN",
        battery: null,
        rssi: device.rssi ?? null
    };
}