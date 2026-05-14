import { View, Text, StyleSheet} from 'react-native'
import React from 'react'
import { AppCard } from '@/src/components/ui/AppCard'
import AppScreen from '@/src/components/ui/AppScreen'
import { colors,shadows,spacing, typography } from '@/src/theme'
import { BikeLogo } from '@/src/components/ui/BikeLogo'
import { AppButton } from '@/src/components/ui/AppButton'
import { AppCardGradient } from '@/src/components/ui/AppCardGradient'

const index = () => {
  return (
    <AppScreen withBottomPadding={false} style = {styles.screen}>
    
        {/*Title*/}
        <AppCard style = {styles.titleCard} >
          <BikeLogo surfaceColor = {colors.primaryDark}></BikeLogo>
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
            onPress={alert}
          ></AppButton>
        </AppCardGradient>

        {/*Device List*/}
        <AppCard style = {styles.devicesCard}>

        </AppCard>

    </AppScreen>

  )
}

export default index

const styles = StyleSheet.create({
  screen : {
    gap : spacing.xs
  },

  description : {
    color : colors.textMuted,
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
    flex : 1,
    backgroundColor: colors.transparent,
    borderWidth: 0
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

  devicesCard: {
    flex : 8
  }
})

