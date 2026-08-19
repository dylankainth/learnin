import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { HomeIcon, ReviewIcon, ProfileIcon } from "@/components/TabBarIcon";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          height: 78,
          paddingTop: 10,
          paddingBottom: 20,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          shadowColor: "#3B2E8A",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
      <Tabs.Screen name="review" options={{ title: "Review", tabBarIcon: ({ color }) => <ReviewIcon color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }} />
    </Tabs>
  );
}
