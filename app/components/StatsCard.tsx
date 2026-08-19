import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  color?: string;
}

export function StatsCard({ label, value, subtext, icon, color = colors.primary }: StatsCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.content}>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>{label}</Text>
        <Text style={[typography.h2]}>{value}</Text>
        {subtext && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{subtext}</Text>}
      </View>
      {icon && <Text style={styles.icon}>{icon}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  content: {
    flex: 1,
  },
  icon: {
    fontSize: 24,
    marginLeft: 10,
  },
});
