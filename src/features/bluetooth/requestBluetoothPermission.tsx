import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  const apiLevel = Number(Platform.Version);

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}



export async function ensureBluetoothPermissions(): Promise<boolean> {
  while (true) {
    const granted = await requestBluetoothPermissions();

    if (granted) {
      return true;
    }

    const shouldRetry = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Bluetooth permission required",
        "The app needs Bluetooth permission to scan and connect to the TRIARE device.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "Try again",
            onPress: () => resolve(true),
          },
          {
            text: "Open settings",
            onPress: () => {
              Linking.openSettings();
              resolve(false);
            },
          },
        ]
      );
    });

    if (!shouldRetry) {
      return false;
    }
  }
}