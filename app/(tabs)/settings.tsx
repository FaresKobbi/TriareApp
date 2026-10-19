import { LanguageSelector } from "@/src/components/ui/LanguageSelector";
import { useI18n } from "@/src/i18n";
import { colors, spacing } from "@/src/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const Settings = () => {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("settings.title")}</Text>

      <Text style={styles.section}>{t("language.title")}</Text>
      <LanguageSelector />
      <Text style={styles.hint}>{t("language.hint")}</Text>
    </View>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.screenPadding,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  section: { marginTop: spacing.md, fontSize: 14, fontWeight: "700", color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted },
});
