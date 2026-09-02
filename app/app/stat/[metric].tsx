import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { api } from "@/lib/api";

type DayRow = {
  date: string;
  reviews: number;
  correct: number;
  firstReviews: number;
  firstCorrect: number;
};

type Point = { date: string; value: number | null };

type MetricConfig = {
  title: string;
  /** solid fullscreen background */
  bg: string;
  /** bar colour */
  accent: string;
  /** text colour on top of bg */
  fg: string;
  /** how the headline number reads */
  unit: string;
  /** true = 0..100 percentage scale, gaps where no data */
  percent?: boolean;
  /** true = on/off bars (streak) */
  binary?: boolean;
  /** build the daily series + headline from the fetched data */
  derive: (days: DayRow[], wpm: number[]) => { points: Point[]; headline: string };
};

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

function currentStreak(days: DayRow[]): number {
  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].reviews > 0) s += 1;
    else if (i === days.length - 1) continue; // today not studied yet — keep counting from yesterday
    else break;
  }
  return s;
}

const METRICS: Record<string, MetricConfig> = {
  cards: {
    title: "Daily reviews",
    bg: "#cbe1c3",
    accent: "#519336",
    fg: "#255312",
    unit: "reviewed today",
    derive: (days) => ({
      points: days.map((d) => ({ date: d.date, value: d.reviews })),
      headline: String(days[days.length - 1]?.reviews ?? 0),
    }),
  },
  reviews: {
    title: "Reviews",
    bg: "#b8dbe1",
    accent: "#0e7490",
    fg: "#134e52",
    unit: "in the last 7 days",
    derive: (days) => ({
      points: days.map((d) => ({ date: d.date, value: d.reviews })),
      headline: String(days.slice(-7).reduce((a, d) => a + d.reviews, 0)),
    }),
  },
  streak: {
    title: "Study streak",
    bg: "#f5cdb8",
    accent: "#c2410c",
    fg: "#7c2d12",
    unit: "day streak",
    binary: true,
    derive: (days) => ({
      points: days.map((d) => ({ date: d.date, value: d.reviews > 0 ? 1 : 0 })),
      headline: String(currentStreak(days)),
    }),
  },
  retention: {
    title: "Retention",
    bg: "#cbc4e1",
    accent: "#4d3aa3",
    fg: "#1f2184",
    unit: "of reviews correct (30d)",
    percent: true,
    derive: (days) => {
      const last30 = days.slice(-30);
      const n = last30.reduce((a, d) => a + d.reviews, 0);
      const c = last30.reduce((a, d) => a + d.correct, 0);
      return {
        points: days.map((d) => ({ date: d.date, value: pct(d.correct, d.reviews) })),
        headline: `${pct(c, n) ?? 0}%`,
      };
    },
  },
  understanding: {
    title: "First-try understanding",
    bg: "#ce9eaa",
    accent: "#7a2030",
    fg: "#420000",
    unit: "of cards right first time",
    percent: true,
    derive: (days) => {
      const n = days.reduce((a, d) => a + d.firstReviews, 0);
      const c = days.reduce((a, d) => a + d.firstCorrect, 0);
      return {
        points: days.map((d) => ({ date: d.date, value: pct(d.firstCorrect, d.firstReviews) })),
        headline: `${pct(c, n) ?? 0}%`,
      };
    },
  },
  wpm: {
    title: "Reading speed",
    bg: "#f5e6c0",
    accent: "#a06020",
    fg: "#7a3e10",
    unit: "words per minute (avg)",
    derive: (days, wpm) => {
      const nonZero = wpm.filter((v) => v > 0);
      return {
        points: days.map((d, i) => ({ date: d.date, value: wpm[i] > 0 ? wpm[i] : null })),
        headline: nonZero.length
          ? String(Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length))
          : "—",
      };
    },
  },
};

const BAR_W = 9;
const BAR_GAP = 4;
const CHART_H = 240;

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StatDetailScreen() {
  const { metric } = useLocalSearchParams<{ metric: string }>();
  const cfg = METRICS[metric ?? ""];

  const [days, setDays] = useState<DayRow[]>([]);
  const [wpm, setWpm] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.progress.timeseries(90);
      setDays(res.days);

      // Reading speed history is stored on-device only
      try {
        const raw = await AsyncStorage.getItem("@learnin/reading_sessions");
        const sessions: { date: string; wpm: number }[] = raw ? JSON.parse(raw) : [];
        const byDate: Record<string, number[]> = {};
        for (const s of sessions) (byDate[s.date] ??= []).push(s.wpm);
        setWpm(
          res.days.map((d) => {
            const v = byDate[d.date];
            return v ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
          }),
        );
      } catch {
        setWpm(res.days.map(() => 0));
      }
    } catch {
      // leave whatever we had
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const derived = useMemo(() => {
    if (!cfg || days.length === 0) return null;
    return cfg.derive(days, wpm);
  }, [cfg, days, wpm]);

  if (!cfg) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: "#FFFFFF" }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: "#111" }]}>‹ Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={{ color: "#666" }}>Unknown stat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const max = derived
    ? cfg.percent
      ? 100
      : cfg.binary
        ? 1
        : Math.max(1, ...derived.points.map((p) => p.value ?? 0))
    : 1;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: cfg.bg }]} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cfg.fg} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backText, { color: cfg.fg }]}>‹ Back</Text>
        </Pressable>

        <Text style={[styles.title, { color: cfg.fg }]}>{cfg.title}</Text>

        {loading && !derived ? (
          <View style={styles.center}>
            <ActivityIndicator color={cfg.fg} />
          </View>
        ) : derived ? (
          <>
            <Text style={[styles.headline, { color: cfg.fg }]}>{derived.headline}</Text>
            <Text style={[styles.unit, { color: cfg.fg }]}>{cfg.unit}</Text>

            <Text style={[styles.chartLabel, { color: cfg.fg }]}>Last 90 days</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScroll}
            >
              <View>
                <View style={[styles.chart, { height: CHART_H }]}>
                  {derived.points.map((p, i) => {
                    const h =
                      p.value === null || p.value === 0
                        ? 0
                        : Math.max(3, (p.value / max) * CHART_H);
                    return (
                      <View key={p.date} style={styles.col}>
                        {h > 0 ? (
                          <View
                            style={{
                              width: BAR_W,
                              height: h,
                              borderRadius: 3,
                              backgroundColor: cfg.accent,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: BAR_W,
                              height: 2,
                              borderRadius: 1,
                              backgroundColor: cfg.fg,
                              opacity: 0.18,
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
                <View style={[styles.axis, { backgroundColor: cfg.fg }]} />
                <View style={styles.labels}>
                  {derived.points.map((p, i) => (
                    <View key={p.date} style={styles.col}>
                      {i % 7 === 0 ? (
                        <Text style={[styles.dayLabel, { color: cfg.fg }]}>{shortDate(p.date)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: "center" },
  back: { paddingVertical: 10, alignSelf: "flex-start" },
  backText: { fontFamily: "Figtree_600SemiBold", fontSize: 16 },
  title: {
    fontFamily: "Figtree_500Medium",
    fontSize: 16,
    marginTop: 12,
    opacity: 0.8,
  },
  headline: {
    fontFamily: "Figtree_700Bold",
    fontSize: 72,
    letterSpacing: -3,
    lineHeight: 78,
    marginTop: 4,
  },
  unit: {
    fontFamily: "Figtree_400Regular",
    fontSize: 16,
    opacity: 0.75,
    marginTop: 2,
  },
  chartLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 13,
    opacity: 0.6,
    marginTop: 44,
    marginBottom: 12,
  },
  chartScroll: { paddingRight: 20 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  col: { width: BAR_W + BAR_GAP, alignItems: "center" },
  axis: { height: 1, opacity: 0.25, marginTop: 0 },
  labels: { flexDirection: "row", marginTop: 6 },
  dayLabel: {
    fontFamily: "Figtree_400Regular",
    fontSize: 10,
    opacity: 0.6,
    width: 60,
  },
});
