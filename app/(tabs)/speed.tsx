import { useBleSession } from "@/src/features/bluetooth/context/BleSessionContext";
import { useMotorControl } from "@/src/features/bluetooth/hooks/useMotorControl";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function SpeedScreen() {
  const session = useBleSession();
  const {
    enable,
    disable,
    stop,
    setRpm,
    setDuty,
    calibrateCrank,
    setGearRatio,
    requestTelemetry,
    telemetry,
    isBusy,
    error,
    isConnected,
  } = useMotorControl(session);

  const [rpmInput, setRpmInput] = useState("500");
  const [dutyInput, setDutyInput] = useState("0.08");
  const [ratioInput, setRatioInput] = useState("1.0");
  const [devEui, setDevEui] = useState<string | null>(null);
  const [devEuiError, setDevEuiError] = useState<string | null>(null);

  const readDevEui = async () => {
    if (!session) return;
    setDevEuiError(null);
    try {
      const bytes = await session.commands.getDevEui();
      setDevEui(
        Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
          .join(":")
      );
    } catch (e) {
      setDevEuiError(e instanceof Error ? e.message : "Failed to read DevEUI");
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Not connected</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isBusy && <ActivityIndicator size="small" />}
      {error != null && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.section}>System</Text>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={enable}>
          <Text style={styles.buttonText}>Enable</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonDanger]} onPress={disable}>
          <Text style={styles.buttonText}>Disable</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={stop}>
          <Text style={styles.buttonText}>Stop</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>RPM</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={rpmInput}
          onChangeText={setRpmInput}
          keyboardType="numeric"
        />
        <Pressable
          style={styles.button}
          onPress={() => setRpm(Number(rpmInput))}
        >
          <Text style={styles.buttonText}>Set RPM</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Duty (-1.0 to 1.0)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={dutyInput}
          onChangeText={setDutyInput}
          keyboardType="numeric"
        />
        <Pressable
          style={styles.button}
          onPress={() => setDuty(Number(dutyInput))}
        >
          <Text style={styles.buttonText}>Set Duty</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Crank / gear ratio</Text>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={calibrateCrank}>
          <Text style={styles.buttonText}>Calibrate crank</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={ratioInput}
          onChangeText={setRatioInput}
          keyboardType="numeric"
        />
        <Pressable
          style={styles.button}
          onPress={() => setGearRatio(Number(ratioInput))}
        >
          <Text style={styles.buttonText}>Set gear ratio</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Telemetry</Text>
      <Pressable style={styles.button} onPress={requestTelemetry}>
        <Text style={styles.buttonText}>Request telemetry</Text>
      </Pressable>
      {telemetry && (
        <View style={styles.telemetryBox}>
          <Text style={styles.telemetryLine}>RPM: {telemetry.rpm.toFixed(1)}</Text>
          <Text style={styles.telemetryLine}>Current: {telemetry.current.toFixed(2)} A</Text>
          <Text style={styles.telemetryLine}>Voltage: {telemetry.voltage.toFixed(2)} V</Text>
          <Text style={styles.telemetryLine}>FET temp: {telemetry.temp.toFixed(1)} °C</Text>
          <Text style={styles.telemetryLine}>
            Crank angle: {telemetry.crankAngleDeg.toFixed(1)}°
          </Text>
          <Text style={styles.telemetryLine}>Fault: {telemetry.fault}</Text>
        </View>
      )}

      <Text style={styles.section}>DevEUI</Text>
      <Pressable style={styles.button} onPress={readDevEui}>
        <Text style={styles.buttonText}>Read DevEUI</Text>
      </Pressable>
      {devEuiError != null && <Text style={styles.error}>{devEuiError}</Text>}
      {devEui != null && <Text style={styles.hex}>{devEui}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "stretch",
    padding: 24,
    gap: 8,
  },
  section: {
    fontSize: 13,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    color: "#888",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  hex: {
    fontSize: 16,
    fontFamily: "monospace",
    marginTop: 4,
  },
  error: {
    color: "#e53935",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#1976D2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonDanger: {
    backgroundColor: "#c62828",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  telemetryBox: {
    marginTop: 8,
    gap: 2,
  },
  telemetryLine: {
    fontFamily: "monospace",
    fontSize: 14,
  },
});