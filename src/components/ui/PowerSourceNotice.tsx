import { TelemetryStatus } from "@/src/features/bluetooth/constants/triareProtocol";
import { useI18n } from "@/src/i18n";
import { colors, radius, spacing } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type PowerSourceNoticeProps = {
  /** Last status byte the board reported (`TelemetryStatus` bits), or `null` before the first. */
  status: number | null;
};

/**
 * Warns that the bus is held by the battery instead of the power supply.
 *
 * The board decides this from the bus voltage and reports it in the status
 * byte. Firmware built without that detection (the default, until the
 * adjustable supply is installed) never sets the bit, so nothing is shown.
 */
export function PowerSourceNotice({ status }: PowerSourceNoticeProps) {
  const { t } = useI18n();
  if (status == null || (status & TelemetryStatus.ON_BATTERY) === 0) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="battery-half" size={32} color={colors.warning} />
      <View style={styles.texts}>
        <Text style={styles.title}>{t("power.onBattery.title")}</Text>
        <Text style={styles.detail}>{t("power.onBattery.detail")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  texts: { flex: 1, gap: 2 },
  title: { color: colors.warning, fontSize: 14, fontWeight: "700" },
  detail: { color: colors.textMuted, fontSize: 13 },
});
