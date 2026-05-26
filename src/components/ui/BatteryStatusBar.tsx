import { colors, radius, spacing } from "@/src/theme";
import { View, Text, StyleSheet } from "react-native";

type BatteryStatusBarProps = {
  level: number | null;
};

export function BatteryStatusBar({ level }: BatteryStatusBarProps) {
  const isUnknown = level === null || level === undefined;
  const safeLevel = isUnknown ? 100 : Math.max(0, Math.min(level, 100));

  function getBatteryColor() {
    if (isUnknown) return colors.textMuted;
    if (safeLevel <= 20) return colors.danger;
    if (safeLevel <= 50) return colors.warning;
    return colors.success;
  }

  return (
    <View style={styles.container}>

      <View style={[styles.batteryOuter, isUnknown && { backgroundColor: colors.textMuted }]}>
        <View
          style={[
            styles.batteryInner,
            {
              width: `${safeLevel}%`,
              backgroundColor: getBatteryColor(),
            },
          ]}
        />
      </View>

      <Text style={styles.percentage}>{isUnknown ? "—%" : `${safeLevel}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 1,
    minWidth: 30,
    maxWidth:40,
  },

  batteryOuter: {
    height: 18,
    width: "100%",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },

  batteryInner: {
    height: "100%",
    borderRadius: radius.full,
  },

  percentage: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
});