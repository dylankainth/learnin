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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [topicsRes, statsRes, heatmapRes, retentionRes] = await Promise.all([
        api.topics.list(),
        api.review.stats(),
        api.progress.heatmap(90),
        api.progress.retention(),
      ]);
      setTopics(topicsRes.topics);
      setStats(statsRes);
      setHeatmap(heatmapRes.heatmap);
      setRetention(retentionRes);
    } catch {}
  }, []);

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

  const last14 = heatmap.slice(-14).map((d) => d.count);
  const hasActivity = last14.some((v) => v > 0);
  const activityBars = hasActivity
    ? Array(14).fill(0).map((_, i) => last14[i] ?? 0)
    : [4, 7, 3, 9, 5, 8, 6, 4, 9, 5, 7, 6, 8, 5];

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
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(firstName[0] ?? "?").toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.welcomeLabel}>Welcome back</Text>
                <Text style={styles.nameText}>{fullName}</Text>
              </View>
            </View>
            <Pressable style={styles.menuBtn} onPress={() => router.push("/(tabs)/profile")}>
              <Text style={styles.menuIcon}>≡</Text>
            </Pressable>
          </View>

          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.greeting}>Hello {firstName}! How are you feeling today?</Text>

          {/* Mood chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.moodScroll}
            contentContainerStyle={{ gap: 10, paddingRight: 20 }}
          >
            {MOODS.map((m) => (
              <View key={m.label} style={styles.moodChip}>
                <View style={[styles.moodEmojiBox, { backgroundColor: m.bg }]}>
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                </View>
                <Text style={styles.moodLabel}>{m.label}</Text>
              </View>
            ))}
          </ScrollView>
        </LinearGradient>

        {/* Stat cards */}
        <View style={styles.cardsRow}>
          <View style={[styles.statCard, { backgroundColor: "#FFD4A0" }]}>
            <Text style={styles.statCardTitle}>🃏  Cards Due</Text>
            <MiniBar values={activityBars} barColor="#C96A0A" />
            <Text style={styles.statBigNum}>{dueNow}</Text>
            <Text style={styles.statBigUnit}>{dueNow === 1 ? "card" : "cards"}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#DDD0F5" }]}>
            <Text style={styles.statCardTitle}>📈  Retention</Text>
            <MiniBar values={retentionBars} barColor="#7C3AED" />
            <Text style={styles.statBigNum}>{retentionRate}%</Text>
            <Text style={styles.statBigUnit}>retention rate</Text>
          </View>
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

  cardsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: { width: CARD_W, borderRadius: 20, padding: 16, gap: 10 },
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
    borderRadius: 20,
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
