import { useState } from "react";
import { Device } from "react-native-ble-plx";
import { mapBleDeviceToTriareDeviceDTO, TriareDeviceDTO } from "@/src/models/triareDeviceDTO";
import { IBluetoothService } from "../IBluetoothService";

type ConnectionStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "error";


export function useBluetoothConnection(bluetoothService: IBluetoothService){
    const [bleDevices, setBleDevices] = useState<Device[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const triareDevicesDTO : TriareDeviceDTO[] = bleDevices.map(mapBleDeviceToTriareDeviceDTO)


    function startScan(){
        setStatus("scanning");
        setError(null);
        setBleDevices([])

        bluetoothService.scanForTriareDevice(
            (newDevice: Device) => {
                setBleDevices((prevDevices) => {
                    const deviceExist = prevDevices.some(d => d.id === newDevice.id);

                    if(deviceExist) return prevDevices;
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
            if(status === "connecting" || status === "connected"){
                setStatus("idle")
            }
        }, 10000);
    }


    function stopScan() {
        bluetoothService.stopScan();
        setStatus("idle");
    };

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

            // Log discovered services and characteristics
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