import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

interface LearningInsightsProps {
  retentionRate: number;
  avgReps: number;
  lapseRate: number;
  optimalReviewTime?: string;
}

export function LearningInsights({
  retentionRate,
  avgReps,
  lapseRate,
  optimalReviewTime,
}: LearningInsightsProps) {
  const calibration = retentionRate >= 80 ? "Excellent calibration" : retentionRate >= 70 ? "Good calibration" : "Needs improvement";
  const calibrationColor = retentionRate >= 80 ? colors.success : retentionRate >= 70 ? colors.blue : colors.danger;

  return (
    <View style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 14 }]}>LEARNING INSIGHTS</Text>

      <View style={styles.grid}>
        <View style={[styles.insight, { borderLeftColor: calibrationColor }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Retention</Text>
          <Text style={[typography.h2, { color: calibrationColor }]}>{retentionRate}%</Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 4 }]}>
            {calibration}
          </Text>
        </View>

        <View style={[styles.insight, { borderLeftColor: colors.primary }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Avg Reps</Text>
          <Text style={[typography.h2, { color: colors.primary }]}>{avgReps.toFixed(1)}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 4 }]}>
            to master
          </Text>
        </View>
      </View>

      {optimalReviewTime && (
        <View style={[styles.insight, { marginTop: 12, borderLeftColor: colors.teal }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Best time to study</Text>
          <Text style={[typography.h2, { color: colors.teal }]}>{optimalReviewTime}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 4 }]}>
            Based on your accuracy
          </Text>
        </View>
      )}

      {lapseRate > 0.2 && (
        <View style={[styles.warning, { backgroundColor: colors.yellowLight }]}>
          <Text style={[typography.caption, { color: colors.orange }]}>
            ⚠ {Math.round(lapseRate * 100)}% lapse rate - try easier cards or more frequent reviews
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  insight: {
    flex: 1,
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 8,
  },
  warning: {
    borderRadius: radii.md,
    padding: 12,
    marginTop: 12,
  },
});
