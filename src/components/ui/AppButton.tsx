import { colors, radius, shadows, spacing, typography } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import {
  Pressable,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle
} from "react-native";



type IoniconsName = ComponentProps<typeof Ionicons>["name"];


type AppButtonProps = {
  title: string;
  /** Background colour of the button. Defaults to the primary brand colour. */
  surfaceColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** When true, renders a coloured drop-shadow matching `surfaceColor`. */
  isShadowed?: boolean;
  /** Optional Ionicons icon rendered to the left of the title. */
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
          backgroundColor: pressed ? colors.primaryDark : surfaceColor,
          padding: spacing.xl,
          borderRadius: radius.button,
          flexDirection: "row",
          gap: spacing.xs,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressed ? 0.95 : 1 }],
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

