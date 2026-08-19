import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface HeatmapData {
  date: string;
  count: number;
}

interface CalendarHeatmapProps {
  data: HeatmapData[];
  title?: string;
}

export function CalendarHeatmap({ data, title = "Study Activity" }: CalendarHeatmapProps) {
  // Group by week, show last 12 weeks
  const today = new Date();
  const startDate = new Date(today.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  const weeks: { week: number; days: (HeatmapData | null)[] }[] = [];

  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const days: (HeatmapData | null)[] = [];

    for (let j = 0; j < 7; j++) {
      const date = new Date(weekStart.getTime() + j * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const found = data.find((d) => d.date === dateStr);
      days.push(found || null);
    }

    weeks.push({ week: i, days });
  }

  const getColor = (count: number | null) => {
    if (!count) return colors.surfaceMuted;
    if (count === 0) return colors.border;
    if (count <= 5) return colors.blue;
    if (count <= 10) return colors.primaryLight;
    if (count <= 20) return colors.primary;
    return colors.primaryDark;
  };

  return (
    <View style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 12 }]}>{title.toUpperCase()}</Text>
      <View style={styles.heatmap}>
        {weeks.map((week) => (
          <View key={week.week} style={styles.column}>
            {week.days.map((day, idx) => (
              <View
                key={idx}
                style={[
                  styles.cell,
                  {
                    backgroundColor: getColor(day?.count ?? null),
                    opacity: !day ? 0.3 : 1,
                  },
                ]}
                title={day ? `${day.count} cards on ${day.date}` : ""}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>Less</Text>
        <View style={[styles.cell, { backgroundColor: colors.border }]} />
        <View style={[styles.cell, { backgroundColor: colors.blue }]} />
        <View style={[styles.cell, { backgroundColor: colors.primary }]} />
        <View style={[styles.cell, { backgroundColor: colors.primaryDark }]} />
        <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  heatmap: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 12,
  },
  column: {
    gap: 2,
  },
  cell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
