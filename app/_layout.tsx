import { BleSessionProvider } from "@/src/features/bluetooth/context/BleSessionContext";
import { Stack } from "expo-router";

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
