import { useI18n } from '@/src/i18n'
import { Tabs } from 'expo-router'
import React from 'react'

const TabsLayout = () => {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="speed"
        options={{
          title: t("tabs.speed"),
        }}
      />
      <Tabs.Screen
        name="resistance"
        options={{
          title: t("tabs.resistance"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
        }}
      />
    </Tabs>
  );
}

export default TabsLayout