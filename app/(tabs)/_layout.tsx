import { Tabs } from 'expo-router'
import React from 'react'

const TabsLayout = () => {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="speed"
        options={{
          title: "Speed",
        }}
      />
      <Tabs.Screen
        name="resistance"
        options={{
          title: "Resistance",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
}

export default TabsLayout