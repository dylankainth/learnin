import React from "react";
import { View, StyleSheet } from "react-native";
import { BlobMascot, Sparkle } from "./BlobMascot";
import { colors } from "@/theme/colors";

/**
 * Hero illustration for onboarding — a loose cluster of mascots, echoing the
 * "friendly shapes crowd" cover art of the reference style.
 */
export function BlobCluster() {
  return (
    <View style={styles.wrap}>
      <View style={[styles.item, { top: 10, left: 30 }]}>
        <BlobMascot color={colors.orange} size={64} variant={2} mood="happy" />
      </View>
      <View style={[styles.item, { top: 60, left: 140 }]}>
        <BlobMascot color={colors.teal} size={72} variant={1} mood="wink" />
      </View>
      <View style={[styles.item, { top: 0, left: 190 }]}>
        <BlobMascot color={colors.pink} size={56} variant={0} mood="excited" />
      </View>
      <View style={[styles.item, { top: 120, left: 20 }]}>
        <BlobMascot color={colors.blue} size={80} variant={3} mood="happy" />
      </View>
      <View style={[styles.item, { top: 140, left: 160 }]}>
        <BlobMascot color={colors.yellow} size={60} variant={2} mood="sleepy" />
      </View>
      <View style={[styles.item, { top: 30, left: 105 }]}>
        <Sparkle color={colors.primary} size={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 280, height: 220 },
  item: { position: "absolute" },
});
