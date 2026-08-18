import React, { PropsWithChildren } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/typography";

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    shadowColor: "#3B2E8A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
});
