import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useOnReconnect } from "@/lib/connectivity";
import type { Topic, ReviewStats } from "@/lib/types";

const { width: W } = Dimensions.get("window");
const PAD = 8;
const CARD_W = (W - PAD * 2 - 8) / 2;

const CARD_BG = "#1E1E1E";

const HERO_CARDS = [
  {
    text: "spongey is always proud of you",
    image: require("../../assets/spongey-love.png"),
    imgStyle: { position: "absolute" as const, bottom: -95, right: -105, width: 280, height: 280 },
  },
  {
    text: "what came first, the chicken or the egg?",
    image: require("../../assets/spongey-thinking.png"),
    imgStyle: { position: "absolute" as const, bottom: -45, right: -10, width: 180, height: 180 },
  },
  {
    text: "working hard or hardly working?",
    image: require("../../assets/spongey-learning.png"),
    imgStyle: { position: "absolute" as const, bottom: -60, right: -50, width: 230, height: 230 },
  },
  {
    text: "Stay cool, folks.",
    image: require("../../assets/spongey-wink.png"),
    imgStyle: { position: "absolute" as const, bottom: -50, right: -25, width: 240, height: 240 },
  },
];

const MOODS = [
  { label: "Focused", emoji: "🎯", bg: "#C8F0D8" },
  { label: "Angry",   emoji: "😠", bg: "#FFD4B0" },
  { label: "Sleepy",  emoji: "😴", bg: "#C8DCF5" },
  { label: "Bored",   emoji: "😑", bg: "#F0C8DC" },
  { label: "Curious", emoji: "🧐", bg: "#E0C8F5" },
];

function MiniBar({ values, barColor }: { values: number[]; barColor: string }) {
  const max = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 52 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            borderRadius: 3,
            height: Math.max(6, (v / max) * 52),
            backgroundColor: barColor,
          }}
        />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [heatmap, setHeatmap] = useState<{ date: string; count: number }[]>([]);
  const [retention, setRetention] = useState<{ lapsed: number; avgReps: number; retentionRate: number } | null>(null);
  const [firstUnderstanding, setFirstUnderstanding] = useState<number | null>(null);
  const [avgWpm, setAvgWpm] = useState<number | null>(null);
  const [wpmBars, setWpmBars] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [heroCard, setHeroCard] = useState(() => HERO_CARDS[Math.floor(Math.random() * HERO_CARDS.length)]);

  const pickHeroCard = useCallback(() => {
    setHeroCard(HERO_CARDS[Math.floor(Math.random() * HERO_CARDS.length)]);
  }, []);

  const loadReadingSpeed = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("@learnin/reading_sessions");
      const sessions: { date: string; wpm: number }[] = raw ? JSON.parse(raw) : [];
      const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recent = sessions.filter((s) => new Date(s.date).getTime() >= cutoffMs);

      const byDate: Record<string, number[]> = {};
      for (const s of recent) {
        if (!byDate[s.date]) byDate[s.date] = [];
        byDate[s.date].push(s.wpm);
      }

      const bars = Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        const key = d.toISOString().split("T")[0];
        const vals = byDate[key];
        return vals ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      });

      setWpmBars(bars);
      const nonZero = bars.filter((v) => v > 0);
      setAvgWpm(nonZero.length > 0 ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : null);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    pickHeroCard();
    try {
      const [topicsRes, statsRes, heatmapRes, retentionRes, firstRes] = await Promise.all([
        api.topics.list(),
        api.review.stats(),
        api.progress.heatmap(90),
        api.progress.retention(),
        api.progress.firstUnderstanding(),
      ]);
      setTopics(topicsRes.topics);
      setStats(statsRes);
      setHeatmap(heatmapRes.heatmap);
      setRetention(retentionRes);
      setFirstUnderstanding(firstRes.rate);
    } catch {}
    await loadReadingSpeed();
  }, [loadReadingSpeed]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));
  useOnReconnect(useCallback(() => { load().catch(() => {}); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const fullName = user?.name ?? "";
  const dueNow = Number(stats?.due_now ?? 0);
  const retentionRate = Math.round(retention?.retentionRate ?? 0);
  const nextTopic = topics[0];

  const streak = Number(stats?.streak ?? 0);

  // Build a date-keyed map of real heatmap data
  const heatmapByDate = Object.fromEntries(heatmap.map((d) => [d.date, d.count]));

  // Real review counts for the past 14 days (no sample fallback)
  const realBars14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return heatmapByDate[d.toISOString().split("T")[0]] ?? 0;
  });
  const reviewsThisWeek = realBars14.slice(7).reduce((a, b) => a + b, 0);
  // Trailing-window streak bars: 1 where that day had activity, for a clean on/off look
  const streakBars = realBars14.map((v) => (v > 0 ? 1 : 0));

  // Sample data for the past 14 days (merged with real data where available)
  const SAMPLE = [3, 7, 5, 12, 8, 15, 6, 9, 4, 11, 7, 13, 10, 5];
  const activityBars = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().split("T")[0];
    return heatmapByDate[key] ?? SAMPLE[i];
  });

  const todayKey = new Date().toISOString().split("T")[0];
  const doneTodayReal = heatmapByDate[todayKey];
  const doneToday = doneTodayReal !== undefined ? doneTodayReal : SAMPLE[13];

  const retentionBars = retentionRate > 0
    ? [20, 35, 28, 45, 40, 55, 50, 62, 58, 70, 65, 75, 72, retentionRate]
    : [2, 4, 3, 6, 4, 7, 5, 8, 6, 9, 7, 8, 7, 9];

  const today = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card — gradient + noise */}
        <LinearGradient
          colors={["#9EC2CE", "#07536C"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroCard}
        >
          <Image
            source={require("../../assets/noise.png")}
            style={[StyleSheet.absoluteFill, { opacity: 0.05, borderRadius: 24 }]}
            resizeMode="cover"
            pointerEvents="none"
          />
          <Text style={styles.greeting}>{heroCard.text}</Text>
          <Image
            source={heroCard.image}
            style={heroCard.imgStyle}
            resizeMode="contain"
            pointerEvents="none"
          />
        </LinearGradient>

        {/* Stat cards — tap through to a full-screen history for each */}
        <View style={styles.cardsGrid}>
          {([
            {
              slug: "cards", bg: "#cbe1c3", bar: "#519336", fg: "#255312",
              bars: activityBars, value: String(doneToday),
              unit: doneToday === 1 ? "card today" : "cards today",
            },
            {
              slug: "retention", bg: "#cbc4e1", bar: "#4d3aa3", fg: "#1f2184",
              bars: retentionBars, value: `${retentionRate}%`, unit: "retention rate",
            },
            {
              slug: "wpm", bg: "#f5e6c0", bar: "#a06020", fg: "#7a3e10",
              bars: wpmBars.length > 0 ? wpmBars : Array(14).fill(0),
              value: avgWpm != null ? String(avgWpm) : "—",
              unit: avgWpm ? "words/min" : "no data yet",
            },
            {
              slug: "understanding", bg: "#ce9eaa", bar: "#7a2030", fg: "#420000",
              bars: Array(14).fill(0).map((_, i) => (i < 13 ? 60 + Math.round(Math.random() * 30) : (firstUnderstanding ?? 0))),
              value: firstUnderstanding !== null ? `${firstUnderstanding}%` : "—",
              unit: "first understanding",
            },
            {
              slug: "streak", bg: "#f5cdb8", bar: "#c2410c", fg: "#7c2d12",
              bars: streakBars, value: String(streak), unit: "day streak",
            },
            {
              slug: "reviews", bg: "#b8dbe1", bar: "#0e7490", fg: "#134e52",
              bars: realBars14, value: String(reviewsThisWeek), unit: "reviews this week",
            },
          ] as const).map((c) => (
            <Pressable
              key={c.slug}
              style={({ pressed }) => [styles.statCard, { backgroundColor: c.bg }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/stat/${c.slug}`)}
            >
              <MiniBar values={c.bars} barColor={c.bar} />
              <Text style={[styles.statBigNum, { color: c.fg }]}>{c.value}</Text>
              <Text style={[styles.statBigUnit, { color: c.fg }]}>{c.unit}</Text>
            </Pressable>
          ))}
        </View>

        {/* Topic card */}
        {nextTopic ? (
          <View style={styles.quizCard}>
            <View style={styles.quizCardHeader}>
              <Text style={styles.quizMeta}>📚  Next up</Text>
              <Text style={styles.quizMeta}>{topics.length} topic{topics.length !== 1 ? "s" : ""}</Text>
            </View>
            <Text style={styles.quizQuestion} numberOfLines={2}>{nextTopic.name}</Text>
            <Text style={styles.quizSub}>{nextTopic.content_count} items · {nextTopic.card_count} cards</Text>
            <View style={styles.quizBtns}>
              <Pressable style={styles.btnDark} onPress={() => router.push(`/study/${nextTopic.id}`)}>
                <Text style={styles.btnDarkText}>Study</Text>
              </Pressable>
              <Pressable style={styles.btnLight} onPress={() => router.push("/create-topic")}>
                <Text style={styles.btnLightText}>+ New topic</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.quizCard}>
            <View style={styles.quizCardHeader}>
              <Text style={styles.quizMeta}>🌱  Get started</Text>
            </View>
            <Text style={styles.quizQuestion}>Ready to start learning?</Text>
            <Text style={styles.quizSub}>Create your first topic to begin.</Text>
            <View style={styles.quizBtns}>
              <Pressable style={styles.btnDark} onPress={() => router.push("/create-topic")}>
                <Text style={styles.btnDarkText}>Create topic</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: PAD, paddingBottom: 100, paddingTop: 8 },


  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 10,
    overflow: "hidden",
    minHeight: 160,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { fontFamily: "Figtree_700Bold", fontSize: 18, color: "#FFFFFF" },
  welcomeLabel: { fontFamily: "Figtree_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)" },
  nameText: { fontFamily: "Figtree_700Bold", fontSize: 17, color: "#FFFFFF" },
  menuBtn: { padding: 6 },
  menuIcon: { fontSize: 26, color: "#FFFFFF", lineHeight: 30 },

  dateText: { fontFamily: "Figtree_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 },

  greeting: {
    fontFamily: "Figtree_700Bold",
    fontSize: 28,
    color: "#FFFFFF",
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  moodScroll: { marginHorizontal: -20, paddingLeft: 0 },
  moodChip: { alignItems: "center", gap: 6 },
  moodEmojiBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: { fontFamily: "Figtree_500Medium", fontSize: 12, color: "rgba(255,255,255,0.85)" },

  cardsRow: { flexDirection: "row", gap: 10, marginBottom: 10, paddingRight: PAD },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  statCard: { width: CARD_W, borderRadius: 14, padding: 16, gap: 10 },
  statCardTitle: { fontFamily: "Figtree_500Medium", fontSize: 12, color: "#333" },
  statBigNum: {
    fontFamily: "Figtree_700Bold",
    fontSize: 40,
    color: "#111111",
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  statBigUnit: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#555",
    marginTop: -2,
  },

  quizCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
  },
  quizCardHeader: { flexDirection: "row", justifyContent: "space-between" },
  quizMeta: { fontFamily: "Figtree_500Medium", fontSize: 12, color: "#78716C" },
  quizQuestion: {
    fontFamily: "Figtree_700Bold",
    fontSize: 18,
    color: "#111111",
    lineHeight: 24,
  },
  quizSub: { fontFamily: "Figtree_400Regular", fontSize: 13, color: "#78716C" },
  quizBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnDark: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDarkText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#FFFFFF" },
  btnLight: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
  },
  btnLightText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111" },
});
