import { colors, radius, spacing, typography } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { BatteryStatusBar } from "./BatteryStatusBar";
import { BikeLogo } from "./BikeLogo";
import { TriareDeviceDTO } from "@/src/models/triareDeviceDTO";





type AppDeviceSelectorProps = {
    device: TriareDeviceDTO;
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
            <View style={styles.infoContainer}>
                <Text style={[typography.cardTitle, styles.deviceName]}>{device.name ?? "Unknown"}</Text>
                <View style={styles.techInfoContainer}>
                    {signalDisplay(device.rssi)}
                    <BatteryStatusBar level={device.battery}></BatteryStatusBar>
                </View>
            </View>

            <View style={{ margin: -spacing.xxl }}>
                <Ionicons name="chevron-forward-outline" size={25}></Ionicons>
            </View>
            {/*device info */}
        </Pressable>
    );

}


const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.onPrimary,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        width: "100%",
        padding: spacing.sm,
        borderRadius: radius.card
    },
    signalLevelIndicator: {
        borderRadius: radius.full,
        height: 10,
        width: 10,
    },
    signalLevelContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs
    },
    infoContainer: {
        justifyContent: "flex-start",
        width: "75%",
        gap: spacing.sm
    },
    techInfoContainer: {
        flexDirection: "row",
        maxWidth: "40%",
        justifyContent: "space-between",
        gap: spacing.xxl,
    },
    deviceName: {
        fontSize: 16
    },


})



{/* HELPER */ }


/**
 * Renders a coloured dot and label for the given RSSI value, or an "Unknown"
 * indicator when RSSI is not available.
 */
function signalDisplay(signal: number | null) {
    if (signal === null || signal === undefined) {
        return (
            <View style={styles.signalLevelContainer}>
                <View style={[styles.signalLevelIndicator, { backgroundColor: colors.textMuted }]}></View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Unknown signal</Text>
            </View>
        );
    }
    const signalStrength = getSignalStrength(signal);
    return (
        <View style={styles.signalLevelContainer}>
            <View style={[styles.signalLevelIndicator, { backgroundColor: signalStrength[1] }]}></View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{signalStrength[0]} signal</Text>
        </View>
    )
}

/**
 * Converts an RSSI value (dBm) to a human-readable label and a colour token.
 *
 * Thresholds are approximate BLE conventions:
 * - ≥ -50 dBm → "Strong" (device is very close)
 * - ≥ -70 dBm → "Good"   (usable range)
 * -  < -70 dBm → "Weak"   (poor signal, may drop)
 *
 * @returns A tuple of [label, colour hex string].
 */
function getSignalStrength(signal: number): [string, string] {
    if (signal >= -50) {
        return ["Strong", colors.success]
    }
    else if (signal >= -70) {
        return ["Good", colors.warning]
    }
    else {
        return ["Weak", colors.danger]
    }
}