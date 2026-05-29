import { AppButton } from '@/src/components/ui/AppButton'
import { AppCard } from '@/src/components/ui/AppCard'
import { AppCardGradient } from '@/src/components/ui/AppCardGradient'
import { AppDeviceSelector } from '@/src/components/ui/AppDeviceSelector'
import AppScreen from '@/src/components/ui/AppScreen'
import { BikeLogo } from '@/src/components/ui/BikeLogo'
import { realBluetoothService } from '@/src/features/bluetooth/BluetoothService'
import { useBluetoothConnection } from '@/src/features/bluetooth/hooks/useBluetoothConnection'
import { ensureBluetoothPermissions } from '@/src/features/bluetooth/requestBluetoothPermission'
import { TriareDeviceDTO } from '@/src/models/triareDeviceDTO'
import { colors, shadows, spacing, typography } from '@/src/theme'
import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'




const Index = () => {

  const {
    triareDevicesDTO,
    status,
    error,
    startScan,
    stopScan,
    connect
  } = useBluetoothConnection(realBluetoothService);

  ensureBluetoothPermissions();


  return (
    <AppScreen withBottomPadding={false} style={styles.screen}>

      {/*Title*/}
      <AppCard style={styles.titleCard}>
        <BikeLogo surfaceColor={colors.primaryDark} bikeColor={colors.onPrimary}></BikeLogo>
        <View>
          <Text style={typography.heroTitle}>Triare</Text>
          <Text style={styles.description}>Rehabilition tricycle control</Text>
        </View>
      </AppCard>

      {/*Scanning Card*/}
      <AppCardGradient
        colors={[colors.primarySoft, colors.onPrimary]}
        containerStyle={[shadows.coloredShadow(colors.primarySoft), styles.scanningCardContainer]}
        style={styles.scanningCard}>

        <View>
          <Text style={typography.heroTitle}>Connect a tricycle</Text>
          <Text style={typography.heroTitle}>to begin a session</Text>
        </View>
        <Text style={[styles.description, styles.scanningCardDescription]}>Make sure the device is powered on and within range. Bluetooth scanning stays active for one minute.</Text>
        <AppButton
          title='Scan for devices'
          textStyle={styles.scanButtonTitle}
          isShadowed={true}
          iconName='search'
          onPress={startScan}
        ></AppButton>
      </AppCardGradient>

      {/*Device List*/}
      <View style={styles.devicesCardTitle}>
        <Text style={[typography.body, { color: colors.textMuted }]}>AVAILABLE DEVICES</Text>
        {displayDevicesCount(triareDevicesDTO)}
      </View>

      <ScrollView
        style={styles.devicesCardContainer}
        contentContainerStyle={styles.devicesCardContent}>

        {triareDevicesDTO.map((device) => (
          <AppDeviceSelector key={device.id} device={device} onPress={alert}></AppDeviceSelector>
        ))}
      </ScrollView>

    </AppScreen>

  )
}


{/** HELPER */ }
function displayDevicesCount(devices: TriareDeviceDTO[]) {
  return (
    <Text style={[typography.body, styles.description]}>{devices.length} found</Text>
  )
}

export default Index

const styles = StyleSheet.create({
  screen: {
    gap: spacing.xs,
  },

  description: {
    color: colors.textLight,
  },

  scanningCardDescription: {
    fontSize: 16
  },

  scanButtonTitle: {
    fontSize: 18,
    color: colors.onPrimary,
    fontWeight: "bold"
  },

  titleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 0,
    backgroundColor: colors.transparent,
    borderWidth: 0,
  },

  scanningCard: {
    flex: 5,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: 250,
    justifyContent: "center",
  },

  scanningCardContainer: {
    flex: 5,
    maxHeight: 250,
    justifyContent: "center",
  },

  devicesCardTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },

  devicesCardContainer: {
    flex: 8,
    backgroundColor: colors.transparent,
    paddingHorizontal: spacing.md
  },

  devicesCardContent: {
    gap: spacing.sm,
  }
})

