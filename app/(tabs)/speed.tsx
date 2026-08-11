import { useBleSession } from "@/src/features/bluetooth/context/BleSessionContext";
import { useBasicCommunication } from "@/src/features/bluetooth/hooks/useBasicCommunication";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SpeedScreen() {
  const session = useBleSession();
  const { currentValue, sendBytes, isLoading, error } =
    useBasicCommunication(session);

  const hexString = currentValue
    ? Array.from(currentValue)
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(" ")
    : "—";

  return (
    <View style={styles.container}>
      {isLoading && <ActivityIndicator size="large" />}
      {error != null && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.label}>Current value</Text>
      <Text style={styles.hex}>{hexString}</Text>
      <Pressable
        style={styles.button}
        onPress={() => sendBytes(new Uint8Array([0x01]))}
      >
        <Text style={styles.buttonText}>Send 0x01</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  label: {
    fontSize: 14,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hex: {
    fontSize: 16,
    fontFamily: "monospace",
    textAlign: "center",
  },
  error: {
    color: "#e53935",
    fontSize: 14,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#1976D2",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
