import { View, Text, StyleSheet, ScrollView} from 'react-native'
import React, { useState } from 'react'
import { AppCard } from '@/src/components/ui/AppCard'
import AppScreen from '@/src/components/ui/AppScreen'
import { colors,radius,shadows,spacing, typography } from '@/src/theme'
import { BikeLogo } from '@/src/components/ui/BikeLogo'
import { AppButton } from '@/src/components/ui/AppButton'
import { AppCardGradient } from '@/src/components/ui/AppCardGradient'
import { Device } from '@/src/models/device'
import { AppDeviceSelector } from '@/src/components/ui/AppDeviceSelector'




const index = () => {

  const [devices, setDevices] = useState<Device[]>([])

  function scanDevices() {
    const foundDevices: Device[] = [
      {
        name: "TRIARE-001",
        battery: 85,
        signal: -45,
      },
      {
        name: "TRIARE-002",
        battery: 25,
        signal: -57,
      },
      {
        name: "TRIARE-003",
        battery: 5,
        signal: -85,
      },
      {
        name: "TRIARE-004",
        battery: 5,
        signal: -85,
      },
      {
        name: "TRIARE-005",
        battery: 5,
        signal: -85,
      },
      {
        name: "TRIARE-006",
        battery: 5,
        signal: -85,
      },
      {
        name: "TRIARE-007",
        battery: 5,
        signal: -85,
      }
    ];

    setDevices(foundDevices);
  }

  return (
    <AppScreen withBottomPadding={false} style = {styles.screen}>
    
        {/*Title*/}
        <AppCard style = {styles.titleCard}>
          <BikeLogo surfaceColor = {colors.primaryDark} bikeColor={colors.onPrimary}></BikeLogo>
          <View>
            <Text style = {typography.heroTitle}>Triare</Text>
            <Text style = {styles.description}>Rehabilition tricycle control</Text>
          </View>
        </AppCard>

        {/*Scanning Card*/}
        <AppCardGradient 
          colors={[colors.primarySoft, colors.onPrimary]}
          containerStyle={[shadows.coloredShadow(colors.primarySoft), styles.scanningCardContainer]}
          style={styles.scanningCard}>

          <View>
            <Text style = {typography.heroTitle}>Connect a tricycle</Text>
            <Text style = {typography.heroTitle}>to begin a session</Text>
          </View>
          <Text style = {[styles.description, styles.scanningCardDescription]}>Make sure the device is powered on and within range. Bluetooth scanning stays active for one minute.</Text>
          <AppButton 
            title='Scan for devices'
            textStyle = {styles.scanButtonTitle}
            isShadowed = {true}
            iconName='search'
            onPress={scanDevices}
          ></AppButton>
        </AppCardGradient>

        {/*Device List*/}
        <ScrollView 
          style = {styles.devicesCardContainer} 
          contentContainerStyle = {styles.devicesCardContent}>
          <View style = {styles.devicesCardTitle}>
              <Text style = {[typography.body, {color: colors.textMuted}]}>AVAILABLE DEVICES</Text>
              {displayDevicesCount(devices)}
          </View>

          {devices.map((device)=>(
            <AppDeviceSelector key={device.name} device={device} onPress={alert}></AppDeviceSelector>
          ))}
        </ScrollView>

    </AppScreen>

  )
}


{/** HELPER */}
function displayDevicesCount(devices: Device[]){
 return (
    <Text style = {[typography.body, styles.description]}>{devices.length} found</Text>
 )
}

export default index

const styles = StyleSheet.create({
  screen : {
    gap : spacing.xs,
  },

  description : {
    color : colors.textLight,
  },

  scanningCardDescription : {
    fontSize : 16
  },

  scanButtonTitle : {
    fontSize : 18,
    color: colors.onPrimary,
    fontWeight: "bold"
  },

  titleCard: { 
    flexDirection: "row",
    alignItems : "center",
    gap: spacing.sm,
    flex : 0,
    backgroundColor: colors.transparent,
    borderWidth: 0,
  },
  
  scanningCard: {
    flex : 5,
    padding : spacing.lg,
    gap : spacing.md,
    maxHeight: 250,
    justifyContent : "center",
  },

  scanningCardContainer:{
    flex : 5,
    maxHeight: 250,
    justifyContent : "center",
  },

  devicesCardTitle:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between"


  },

  devicesCardContainer: {
    flex : 8,
    backgroundColor: colors.transparent,
    paddingHorizontal:spacing.md
  },
  
  devicesCardContent:{
    gap: spacing.sm,
  }
})

