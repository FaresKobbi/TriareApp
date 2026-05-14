import { ComponentProps } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing } from "@/src/theme";

type AppCardGradientProps = ComponentProps<typeof LinearGradient> & {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppCardGradient({
  style,
  containerStyle,
  colors: gradientColors = [colors.primarySoft, colors.onPrimary],
  start = { x: -0.1, y: -0.1 },
  end = { x: 1, y: 1 },
  ...props
}: AppCardGradientProps) {
  return (
    <View
      style={[
        {
          borderRadius: radius.card,
          backgroundColor: colors.surface,
        },
        containerStyle,
      ]}
    >
      <LinearGradient
        {...props}
        colors={gradientColors}
        start={start}
        end={end}
        style={[
          {
            borderRadius: radius.card,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.transparent,
            overflow: "hidden",
          },
          style,
        ]}
      />
    </View>
  );
}