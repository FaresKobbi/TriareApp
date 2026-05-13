import { colors, radius, shadows, spacing, typography } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import {
  Pressable,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  StyleSheet
} from "react-native";



type IoniconsName = ComponentProps<typeof Ionicons>["name"];

let isPressed = false;

type AppButtonProps = {
  title: string;
  surfaceColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  isShadowed?: boolean;
  iconName?: IoniconsName;
  onPress: () => void;
};

export function AppButton({
  title,
  surfaceColor = colors.primary,
  style,
  textStyle,
  isShadowed = false,
  iconName,
  onPress,
}: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) =>[
        {
          backgroundColor: pressed ? colors.primarySoft : surfaceColor,
          padding: spacing.xl,
          borderRadius: radius.button,
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
        isShadowed && shadows.coloredShadow(surfaceColor) 
    ]}
    >

      {iconName && (
        <Ionicons name={iconName} size={20} color="white" />
      )}

      <Text
        style={[
          typography.body,
          textStyle,
          
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
  
}

