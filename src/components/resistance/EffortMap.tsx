import { useI18n } from "@/src/i18n";
import { colors } from "@/src/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  /** Fraction of the help (0–1) in each equal slice of the turn, starting at 0°. */
  factors: readonly number[];
  /** Where the pedal is, in the angle of the leg being worked (0–360), or null. */
  markerDeg: number | null;
};

const HEIGHT = 56;

/**
 * The turn of the pedal laid out flat: one bar per slice, as tall as the help
 * the board will give there. Shows at a glance where the weak part is covered.
 */
export function EffortMap({ factors, markerDeg }: Props) {
  const { t } = useI18n();
  const marker =
    markerDeg == null || !Number.isFinite(markerDeg) ? null : ((markerDeg % 360) + 360) % 360;

  return (
    <View accessible accessibilityLabel={t("resist.map.title")}>
      <View style={styles.plot}>
        {factors.map((factor, i) => (
          <View key={i} style={styles.cell}>
            <View
              style={[
                styles.bar,
                { height: Math.max(2, Math.round(HEIGHT * Math.min(1, Math.max(0, factor)))) },
              ]}
            />
          </View>
        ))}
        {marker != null && (
          <View pointerEvents="none" style={[styles.marker, { left: `${(marker / 360) * 100}%` }]} />
        )}
      </View>
      <View style={styles.ticks}>
        {[0, 90, 180, 270, 360].map((deg) => (
          <Text key={deg} style={styles.tick}>
            {deg}°
          </Text>
        ))}
      </View>
      <Text style={styles.legend}>{t("resist.map.legend")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    height: HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    overflow: "hidden",
  },
  cell: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 0.5 },
  bar: { backgroundColor: colors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  marker: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: colors.danger },
  ticks: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  tick: { fontSize: 11, color: colors.textLight },
  legend: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
