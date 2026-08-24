import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { StreakBadge } from "@/components/StreakBadge";
import { TopicCard } from "@/components/TopicCard";
import { CalendarHeatmap } from "@/components/CalendarHeatmap";
import { LearningInsights } from "@/components/LearningInsights";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Topic, ReviewStats } from "@/lib/types";

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
    } catch {
      // Errors already handled by API
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  const dueNow = Number(stats?.due_now ?? 0);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <FlatList
        data={topics}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 8 }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[typography.body, { color: colors.textMuted }]}>Welcome back</Text>
                <Text style={typography.h1}>{firstName} 👋</Text>
              </View>
            </View>

            <StreakBadge
              streak={stats?.streak ?? 0}
              subtitle={dueNow > 0 ? `${dueNow} card${dueNow === 1 ? "" : "s"} due today` : "You're all caught up!"}
            />

            {dueNow > 0 && (
              <Pressable style={styles.reviewCta} onPress={() => router.push("/review/session")}>
                <Text style={[typography.button, { color: "#fff" }]}>Start today's review</Text>
              </Pressable>
            )}

            {retention && (
              <View style={{ gap: 12 }}>
                <LearningInsights
                  retentionRate={retention.retentionRate}
                  avgReps={retention.avgReps}
                  lapseRate={retention.lapsed / Math.max(retention.lapsed + retention.retentionRate, 1)}
                />
                <CalendarHeatmap data={heatmap} title="Study Activity (90d)" />
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={typography.h2}>Your topics</Text>
              <Pressable onPress={() => router.push("/create-topic")}>
                <Text style={[typography.bodyMedium, { color: colors.primary }]}>+ New</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TopicCard
            id={item.id}
            name={item.name}
            description={item.description}
            contentCount={item.content_count}
            dueCount={item.due_count}
            cardCount={item.card_count}
            onPress={() => router.push(`/topic/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No topics yet. Create one and add content to get started.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 104, paddingTop: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  empty: { paddingTop: 40, paddingHorizontal: 20 },
});
