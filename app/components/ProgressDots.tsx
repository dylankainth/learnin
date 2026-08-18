import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";

export function ProgressDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i === activeIndex ? colors.primary : colors.primarySoft, width: i === activeIndex ? 22 : 8 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  dot: { height: 8, borderRadius: 4 },
});
