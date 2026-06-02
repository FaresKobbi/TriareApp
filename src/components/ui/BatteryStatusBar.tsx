import { colors, radius, spacing } from "@/src/theme";
import { View, Text, StyleSheet } from "react-native";

type BatteryStatusBarProps = {
  /** Battery level as a percentage (0–100), or `null` when not yet available from the device. */
  level: number | null;
};

/**
 * Horizontal battery bar with a percentage label.
 *
 * When `level` is `null` the bar renders in a muted style to signal that the
 * value is unavailable (e.g. firmware does not yet expose a battery characteristic).
 * When `level` is provided it is clamped to [0, 100] before rendering.
 */
export function BatteryStatusBar({ level }: BatteryStatusBarProps) {
  const isUnknown = level === null || level === undefined;
  // Clamp to [0, 100] to guard against out-of-range values from the firmware.
  const safeLevel = isUnknown ? 100 : Math.max(0, Math.min(level, 100));

  /**
   * Returns a colour token based on battery level thresholds:
   * - ≤ 20 % → danger (critical)
   * - ≤ 50 % → warning (low)
   * - > 50 % → success (healthy)
   */
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