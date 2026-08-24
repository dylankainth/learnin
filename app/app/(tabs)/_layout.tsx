import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { HomeIcon, ReviewIcon, ProfileIcon } from "@/components/TabBarIcon";

const NAV_BG = "#002B3A";

export default function TabsLayout() {
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarStyle: {
          position: "absolute",
          bottom: 20,
          left: 80,
          right: 80,
          borderRadius: 28,
          height: 64,
          backgroundColor: NAV_BG,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="review" options={{ tabBarIcon: ({ color }) => <ReviewIcon color={color} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }} />
    </Tabs>
  );
}
