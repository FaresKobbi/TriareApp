import { AppButton } from '@/src/components/ui/AppButton'
import { AppCard } from '@/src/components/ui/AppCard'
import { AppCardGradient } from '@/src/components/ui/AppCardGradient'
import { AppDeviceSelector } from '@/src/components/ui/AppDeviceSelector'
import AppScreen from '@/src/components/ui/AppScreen'
import { BikeLogo } from '@/src/components/ui/BikeLogo'
import { LanguageSelector } from '@/src/components/ui/LanguageSelector'
import { BluetoothConnectionHandler } from '@/src/features/bluetooth/handler/BluetoothConnectionHandler'
import { useBluetoothConnection } from '@/src/features/bluetooth/hooks/useBluetoothConnection'
import { ensureBluetoothPermissions } from '@/src/features/bluetooth/requestBluetoothPermission'
import { useI18n } from '@/src/i18n'
import { colors, shadows, spacing, typography } from '@/src/theme'
import React, { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'




/**
 * Entry screen — device pairing / connection screen.
 *
 * Lets the user scan for nearby TRIARE devices and connect to one to begin a
 * rehabilitation session. Bluetooth permissions are requested here so the user
 * sees the rationale before any scan is attempted.
 *
 * TODO: `ensureBluetoothPermissions()` is currently called directly in the
 * component body, which means it re-fires on every render. Move it into a
 * `useEffect` with an empty dependency array so it runs only once on mount.
 */
const Index = () => {
  const { t, tp } = useI18n();

  const {
    triareDevicesDTO,
    status,
    error,
    startScan,
    stopScan,
    connect
  } = useBluetoothConnection(BluetoothConnectionHandler.getInstance());

  // avoid triggering the permission dialog on every re-render.
  useEffect(() => {ensureBluetoothPermissions();}, [])


  return (
    <AppScreen withBottomPadding={false} style={styles.screen}>

      {/*Title*/}
      <AppCard style={styles.titleCard}>
        <BikeLogo surfaceColor={colors.primaryDark} bikeColor={colors.onPrimary}></BikeLogo>
        <View>
          <Text style={typography.heroTitle}>{t('app.name')}</Text>
          <Text style={styles.description}>{t('app.tagline')}</Text>
        </View>
        <View style={styles.languageBox}>
          <LanguageSelector compact />
        </View>
      </AppCard>

      {/*Scanning Card*/}
      <AppCardGradient
        colors={[colors.primarySoft, colors.onPrimary]}
        containerStyle={[shadows.coloredShadow(colors.primarySoft), styles.scanningCardContainer]}
        style={styles.scanningCard}>

        <View>
          <Text style={typography.heroTitle}>{t('home.connectLine1')}</Text>
          <Text style={typography.heroTitle}>{t('home.connectLine2')}</Text>
        </View>
        <Text style={[styles.description, styles.scanningCardDescription]}>{t('home.scanHelp')}</Text>
        <AppButton
          title={t('home.scanButton')}
          textStyle={styles.scanButtonTitle}
          isShadowed={true}
          iconName='search'
          onPress={startScan}
        ></AppButton>
      </AppCardGradient>

      {/*Device List*/}
      <View style={styles.devicesCardTitle}>
        <Text style={[typography.body, { color: colors.textMuted }]}>{t('home.availableDevices')}</Text>
        <Text style={[typography.body, styles.description]}>{tp('home.devicesFound', triareDevicesDTO.length)}</Text>
      </View>

      <ScrollView
        style={styles.devicesCardContainer}
        contentContainerStyle={styles.devicesCardContent}>

        {triareDevicesDTO.map((device) => (
          <AppDeviceSelector key={device.id} device={device} onPress={() => connect(device.id)}></AppDeviceSelector>
        ))}
      </ScrollView>

    </AppScreen>

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

  languageBox: {
    flex: 1,
    alignItems: "flex-end",
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

