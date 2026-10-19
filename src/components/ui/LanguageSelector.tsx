import { Language, LANGUAGES, useI18n } from "@/src/i18n";
import { colors, radius, spacing } from "@/src/theme";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  /** Smaller buttons, for use next to other content. */
  compact?: boolean;
};

/**
 * Two-button switch for the app language. The names are written in their own
 * language ("English", "Português (Brasil)") so they can be found whichever
 * language is active.
 */
export function LanguageSelector({ compact = false }: Props) {
  const { language, t, setLanguage } = useI18n();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t("language.title")}>
      {LANGUAGES.map((option) => {
        const selected = option.code === language;
        return (
          <Pressable
            key={option.code}
            onPress={() => setLanguage(option.code as Language)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t("language.a11y", { language: option.label })}
            style={[styles.option, compact && styles.optionCompact, selected && styles.optionSelected]}
          >
            <Text
              style={[styles.optionText, compact && styles.optionTextCompact, selected && styles.optionTextSelected]}
            >
              {compact ? shortLabel(option.code as Language) : option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function shortLabel(code: Language): string {
  return code === "pt-BR" ? "PT" : "EN";
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.xs },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionCompact: { paddingVertical: 4, paddingHorizontal: 12 },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontSize: 14, fontWeight: "600", color: colors.text },
  optionTextCompact: { fontSize: 12 },
  optionTextSelected: { color: colors.onPrimary },
});
