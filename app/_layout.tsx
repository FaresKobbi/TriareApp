import { HeaderTitle } from "@react-navigation/elements";
import { Stack } from "expo-router";
import { StackScreen } from "react-native-screens";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="connection" />
      <Stack.Screen name="connection-lost" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
