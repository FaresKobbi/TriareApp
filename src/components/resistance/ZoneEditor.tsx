import { useI18n } from "@/src/i18n";
import { colors } from "@/src/theme";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

/** A zone as typed: text fields, so a half-typed number is not thrown away. */
export type ZoneFields = { start: string; end: string; percent: string };

type Props = {
  zones: ZoneFields[];
  onChange: (zones: ZoneFields[]) => void;
  /** Most zones the board can hold. */
  max: number;
  disabled?: boolean;
};

const EXAMPLE: ZoneFields = { start: "60", end: "150", percent: "0" };

/** Rows of "from / to / help %" for the zones with less help. */
export function ZoneEditor({ zones, onChange, max, disabled }: Props) {
  const { t } = useI18n();

  const update = (index: number, patch: Partial<ZoneFields>) =>
    onChange(zones.map((z, i) => (i === index ? { ...z, ...patch } : z)));

  return (
    <View style={styles.box}>
      {zones.length === 0 && <Text style={styles.empty}>{t("resist.zones.empty")}</Text>}
      {zones.map((zone, index) => (
        <View key={index} style={styles.zone}>
          <View style={styles.zoneHeader}>
            <Text style={styles.zoneTitle}>{t("resist.zones.item", { n: index + 1 })}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onChange(zones.filter((_, i) => i !== index))}
            >
              <Text style={styles.remove}>{t("resist.zones.remove")}</Text>
            </Pressable>
          </View>
          <View style={styles.fields}>
            <Field
              label={t("resist.zones.start")}
              value={zone.start}
              onChangeText={(start) => update(index, { start })}
              disabled={disabled}
            />
            <Field
              label={t("resist.zones.end")}
              value={zone.end}
              onChangeText={(end) => update(index, { end })}
              disabled={disabled}
            />
            <Field
              label={t("resist.zones.percent")}
              value={zone.percent}
              onChangeText={(percent) => update(index, { percent })}
              disabled={disabled}
            />
          </View>
        </View>
      ))}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || zones.length >= max}
          onPress={() => onChange([...zones, { start: "0", end: "90", percent: "50" }])}
          style={[styles.chip, (disabled || zones.length >= max) && styles.chipOff]}
        >
          <Text style={styles.chipText}>{t("resist.zones.add")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled || zones.length >= max}
          onPress={() => onChange([...zones, EXAMPLE])}
          style={[styles.chip, (disabled || zones.length >= max) && styles.chipOff]}
        >
          <Text style={styles.chipText}>{t("resist.zones.example")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType="numeric"
        editable={!props.disabled}
        accessibilityLabel={props.label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  empty: { fontSize: 14, color: colors.textMuted },
  zone: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    backgroundColor: colors.surface,
  },
  zoneHeader: { flexDirection: "row", justifyContent: "space-between" },
  zoneTitle: { fontWeight: "700", color: colors.text },
  remove: { color: colors.dangerDark, fontWeight: "600" },
  fields: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 12, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    color: colors.text,
  },
  actions: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipOff: { opacity: 0.4 },
  chipText: { color: colors.primaryDark, fontWeight: "600" },
});
