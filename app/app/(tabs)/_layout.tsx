import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { HomeIcon, ReviewIcon, ProfileIcon, ListIcon, SettingsIcon } from "@/components/TabBarIcon";

const NAV_BG = "#111111";

export default function TabsLayout() {
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(NAV_BG);
    NavigationBar.setButtonStyleAsync("light");
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
        tabBarStyle: {
          height: 68,
          backgroundColor: NAV_BG,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 12,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="topics" options={{ tabBarIcon: ({ color }) => <ListIcon color={color} /> }} />
      <Tabs.Screen name="review" options={{ tabBarIcon: ({ color }) => <ReviewIcon color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }} />
    </Tabs>
  );
}
