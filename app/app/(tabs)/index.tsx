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

  // Build a date-keyed map of real heatmap data
  const heatmapByDate = Object.fromEntries(heatmap.map((d) => [d.date, d.count]));

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

        {/* Stat cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W + 10}
          decelerationRate="fast"
          contentContainerStyle={styles.cardsRow}
        >
          <View style={[styles.statCard, { backgroundColor: "#cbe1c3" }]}>
            <MiniBar values={activityBars} barColor="#519336" />
            <Text style={[styles.statBigNum, { color: "#255312" }]}>{doneToday}</Text>
            <Text style={[styles.statBigUnit, { color: "#255312" }]}>{doneToday === 1 ? "card today" : "cards today"}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#cbc4e1" }]}>
            <MiniBar values={retentionBars} barColor="#4d3aa3" />
            <Text style={[styles.statBigNum, { color: "#1f2184" }]}>{retentionRate}%</Text>
            <Text style={[styles.statBigUnit, { color: "#1f2184" }]}>retention rate</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#f5e6c0" }]}>
            <MiniBar values={wpmBars.length > 0 ? wpmBars : Array(14).fill(0)} barColor="#a06020" />
            <Text style={[styles.statBigNum, { color: "#7a3e10" }]}>{avgWpm ?? "—"}</Text>
            <Text style={[styles.statBigUnit, { color: "#7a3e10" }]}>{avgWpm ? "words/min" : "no data yet"}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#ce9eaa" }]}>
            <MiniBar values={Array(14).fill(0).map((_, i) => (i < 13 ? 60 + Math.round(Math.random() * 30) : (firstUnderstanding ?? 0)))} barColor="#7a2030" />
            <Text style={[styles.statBigNum, { color: "#420000" }]}>{firstUnderstanding !== null ? `${firstUnderstanding}%` : "—"}</Text>
            <Text style={[styles.statBigUnit, { color: "#420000" }]}>first understanding</Text>
          </View>
        </ScrollView>

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
              <Pressable style={styles.btnDark} onPress={() => router.push(`/topic/${nextTopic.id}`)}>
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
