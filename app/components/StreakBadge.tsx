import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

function FlameIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2 1 4-1 5-2 5a2.5 2.5 0 0 1-2.5-2.5c0-2 2-3 1.5-5.5C15.5 6 18 8 18 12a6 6 0 1 1-12 0c0-4 3-7 6-10Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export function StreakBadge({ streak, subtitle }: { streak: number; subtitle: string }) {
  return (
    <LinearGradient colors={[colors.orange, "#C96A00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.iconWrap}>
        <FlameIcon />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.h2, { color: "#fff" }]}>{subtitle}</Text>
        <Text style={[typography.caption, { color: colors.orangeLight }]}>See your progress →</Text>
      </View>
      <Text style={styles.streakNumber}>{streak}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    padding: 16,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: { ...typography.display, color: "#fff" },
});
