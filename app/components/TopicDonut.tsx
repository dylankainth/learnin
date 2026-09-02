import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { accentFor } from "@/theme/colors";
import type { Topic } from "@/lib/types";

const SIZE = 168;
const STROKE = 30;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function TopicDonut({ topics }: { topics: Topic[] }) {
  const slices = topics
    .map((t) => ({
      name: t.name,
      value: t.studied_count ?? 0,
      color: accentFor(t.name).fg,
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Progress by topic</Text>
        <Text style={styles.empty}>Study some cards to see how your progress splits across topics.</Text>
      </View>
    );
  }

  let offset = 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Progress by topic</Text>
      <View style={styles.row}>
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke="#EFEDE7"
                strokeWidth={STROKE}
                fill="none"
              />
              {slices.map((s) => {
                const len = (s.value / total) * C;
                const el = (
                  <Circle
                    key={s.name}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    fill="none"
                  />
                );
                offset += len;
                return el;
              })}
            </G>
          </Svg>
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerNum}>{total}</Text>
            <Text style={styles.centerLabel}>cards</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {slices.map((s) => (
            <View key={s.name} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={styles.legendName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.legendVal}>{s.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    padding: 18,
    marginBottom: 10,
    gap: 14,
  },
  title: {
    fontFamily: "Figtree_700Bold",
    fontSize: 16,
    color: "#111111",
  },
  empty: {
    fontFamily: "Figtree_400Regular",
    fontSize: 13,
    color: "#78716C",
    lineHeight: 19,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerNum: {
    fontFamily: "Figtree_700Bold",
    fontSize: 30,
    color: "#111111",
    letterSpacing: -1,
  },
  centerLabel: {
    fontFamily: "Figtree_400Regular",
    fontSize: 12,
    color: "#78716C",
    marginTop: -2,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontFamily: "Figtree_500Medium",
    fontSize: 13,
    color: "#1C1917",
  },
  legendVal: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 13,
    color: "#78716C",
  },
});
