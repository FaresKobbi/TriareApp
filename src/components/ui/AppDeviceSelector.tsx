import { Device } from "@/src/models/device";
import { colors, radius, spacing, typography } from "@/src/theme";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BikeLogo } from "./BikeLogo";





type AppDeviceSelectorProps = {
    device: Device;
    onPress: () => void;
};

export function AppDeviceSelector({
    device,
    onPress
}: AppDeviceSelectorProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
    >
        <BikeLogo surfaceColor={colors.primarySoft} bikeColor={colors.primaryDark}></BikeLogo>
        <View style = {styles.infoContainer}>
            <Text style = {[typography.cardTitle, styles.deviceName]}>{device.name}</Text>
            <View style = {styles.techInfoContainer}>
                {signalDisplay(device.signal)}
                <Text>oakfjda</Text>
            </View>
        </View>

        {/*device info */}
    </Pressable>
  );
  
}


const styles = StyleSheet.create({
    container:{
        backgroundColor : colors.onPrimary,
        flexDirection : "row",
        alignItems:"center",
        gap: spacing.md,
        width: "100%",
        padding: spacing.sm,
        borderRadius: radius.card
    },
    signalLevelIndicator: {
        borderRadius : radius.full,
        height:10,
        width:10,
    },
    signalLevelContainer:{
        flexDirection: "row",
        alignItems:"center",
        gap: spacing.xs
    },
    infoContainer:{
        justifyContent:"flex-start",
        width:"75%",
        gap: spacing.sm
    },
    techInfoContainer:{
        flexDirection:"row",
        justifyContent:"space-between",
    },
    deviceName:{
        fontSize: 16
    },

    
})



{/* HELPER */}

function signalDisplay(signal: number){
    const signalStrength = getSignalStrength(signal);
    return (
    <View style={styles.signalLevelContainer}>
        <View style={[styles.signalLevelIndicator, {backgroundColor: signalStrength[1]}]}></View>
        <Text style = {{color : colors.textMuted, fontSize: 12}}>{signalStrength[0]} signal</Text>       
    </View>
    )
}

function getSignalStrength(signal: number):[string, string]{
    if(signal >= -50){
        return ["Strong", colors.success]
    }
    else if(signal >= -70){
        return ["Good", colors.warning]
    }
    else {
        return ["Weak", colors.danger]
    }
}