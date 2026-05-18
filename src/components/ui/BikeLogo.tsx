import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, shadows } from "@/src/theme";

type BikeLogoProps = {
    surfaceColor : string;
    bikeColor : string;
}

export function BikeLogo({surfaceColor, bikeColor}: BikeLogoProps) {
  return (
    <View
      style={[{
        width: 56,
        height: 56,
        borderRadius: radius.iconTile,
        backgroundColor: surfaceColor,
        alignItems: "center",
        justifyContent: "center",
      },
      shadows.coloredShadow(surfaceColor) 
      ]}
    >
      <MaterialCommunityIcons
        name="bicycle"
        size={30}
        color={bikeColor}
      />
    </View>
  );
}