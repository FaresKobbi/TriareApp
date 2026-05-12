import { View, ViewProps } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

export function AppCard({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    />
  );
}