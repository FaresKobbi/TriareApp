import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

/**
 * Requests the Android runtime permissions required for BLE scanning and connection.
 *
 * On iOS, BLE permissions are declared in Info.plist and the system prompts
 * automatically, so this function returns `true` immediately.
 *
 * Android permission model differs by API level:
 * - API ≥ 31 (Android 12+): requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT.
 * - API < 31: requires ACCESS_FINE_LOCATION (BLE scanning was gated behind
 *   location permission before Android 12).
 *
 * @returns `true` if all required permissions are granted, `false` otherwise.
 */
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

/**
 * Repeatedly requests Bluetooth permissions until the user grants them or
 * explicitly cancels.
 *
 * Presents an alert with three choices when permission is denied:
 * - "Cancel"        – stops retrying and returns `false`.
 * - "Try again"     – re-requests runtime permission.
 * - "Open settings" – opens the system app settings so the user can grant
 *                     permission that was previously denied with "Don't ask again",
 *                     then returns `false` (the caller must handle the app resuming
 *                     from settings).
 *
 * Call this function before starting a BLE scan. Do not call it in a background
 * context where showing an alert is inappropriate.
 *
 * @returns `true` if permissions are eventually granted, `false` if the user cancels.
 */
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