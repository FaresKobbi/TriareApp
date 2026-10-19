import { BleSessionProvider } from "@/src/features/bluetooth/context/BleSessionContext";
import { initLanguage } from "@/src/i18n";
import { Stack } from "expo-router";

// Starts in the phone's language (Portuguese or English). The user can change
// it in Settings or on the scan screen.
initLanguage();

export default function RootLayout() {
  return (
    <BleSessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="connection_lost" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </BleSessionProvider>
  );
}
