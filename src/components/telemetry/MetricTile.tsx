import { Level } from "@/src/features/telemetry/telemetryInfo";
import { TranslationKey, useI18n } from "@/src/i18n";
import { colors, radius, spacing } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { ComponentProps, ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const LEVEL_COLOR: Record<Level, string> = {
  ok: colors.success,
  warn: colors.warning,
  danger: colors.danger,
};

const LEVEL_WORD: Record<Level, TranslationKey> = {
  ok: "level.ok",
  warn: "level.warn",
  danger: "level.danger",
};

type Props = {
  icon: IoniconsName;
  label: string;
  /** Main reading, already formatted ("25.3"). Null shows an em dash. */
  value: string | null;
  unit?: string;
  /** Extra lines under the value (other units, notes). */
  detail?: string;
  /** Colors the dot and the value; omit for readings without limits. */
  level?: Level;
  /** What this measures and what to watch for; shown when the tile is tapped. */
  hint: string;
  /** Chart or other content below the value. */
  children?: ReactNode;
  /** Takes the full row instead of half. */
  wide?: boolean;
};

/** One measurement: icon, name, value, optional chart, and a tap-to-explain hint. */
export function MetricTile({
  icon,
  label,
  value,
  unit,
  detail,
  level,
  hint,
  children,
  wide = false,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const accent = level ? LEVEL_COLOR[level] : colors.textMuted;
  const valueText = value ?? "—";

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${valueText}${unit ? ` ${unit}` : ""}${
        level ? `, ${t(LEVEL_WORD[level])}` : ""
      }`}
      accessibilityHint={open ? t("tile.hideHint") : t("tile.showHint")}
      style={[styles.tile, wide ? styles.wide : styles.half]}
    >
      <View style={styles.header}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {level && <View style={[styles.dot, { backgroundColor: accent }]} />}
        <Ionicons
          name={open ? "chevron-up" : "information-circle-outline"}
          size={15}
          color={colors.textLight}
        />
      </View>

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            valueText.length > 8 && styles.valueLong,
            level === "danger" && { color: colors.danger },
          ]}
        >
          {valueText}
        </Text>
        {unit && value !== null && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}

      {children}

      {open && <Text style={styles.hint}>{hint}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.insetCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  half: { flexBasis: "48%", flexGrow: 1 },
  wide: { flexBasis: "100%", flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  value: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  valueLong: { fontSize: 18, lineHeight: 24 },
  unit: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  detail: { fontSize: 12, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 13, lineHeight: 19, color: colors.text },
});
