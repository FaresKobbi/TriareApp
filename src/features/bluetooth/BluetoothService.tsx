import { BleManager, Device } from "react-native-ble-plx";
import { requestBluetoothPermissions } from "./hooks/requestBluetoothPermission";


class BluetoothService{
    private bleManager = new BleManager();
    


    scanForDevice = async () => {
        const permissionResult = await requestBluetoothPermissions();
        console.log(permissionResult);
    }

}




export const bluetoothService = new BluetoothService();