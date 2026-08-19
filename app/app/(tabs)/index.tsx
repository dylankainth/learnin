import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { StreakBadge } from "@/components/StreakBadge";
import { TopicCard } from "@/components/TopicCard";
import { CalendarHeatmap } from "@/components/CalendarHeatmap";
import { StatsCard } from "@/components/StatsCard";
import { LearningInsights } from "@/components/LearningInsights";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Topic, ReviewStats } from "@/lib/types";

export default function HomeScreen() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [heatmap, setHeatmap] = useState<{ date: string; count: number }[]>([]);
  const [retention, setRetention] = useState<{ studied: number; mastered: number; lapsed: number; avgReps: number; retentionRate: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);

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

  async function handleCreateTopic() {
    if (!newTopicName.trim()) {
      Alert.alert("Topic name required");
      return;
    }
    setCreatingTopic(true);
    try {
      const res = await api.topics.create(newTopicName, newTopicDesc || undefined);
      setNewTopicName("");
      setNewTopicDesc("");
      setShowCreateModal(false);
      router.push(`/topic/${res.topic.id}`);
    } catch (err) {
      Alert.alert("Failed to create topic", err instanceof Error ? err.message : "");
    } finally {
      setCreatingTopic(false);
    }
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
                <Text style={[typography.caption, { color: colors.textMuted }]}>YOUR PROGRESS</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <StatsCard
                    label="Mastered"
                    value={retention.mastered}
                    icon="✨"
                    color={colors.success}
                    subtext={`${retention.retentionRate}% retention`}
                  />
                  <StatsCard
                    label="Studied"
                    value={retention.studied}
                    icon="📚"
                    color={colors.blue}
                  />
                </View>
                <LearningInsights
                  retentionRate={retention.retentionRate}
                  avgReps={retention.avgReps}
                  masteredCards={retention.mastered}
                  lapseRate={retention.lapsed / Math.max(retention.studied, 1)}
                />
                <CalendarHeatmap data={heatmap} title="Study Activity (90d)" />
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={typography.h2}>Your topics</Text>
              <Pressable onPress={() => setShowCreateModal(true)}>
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

      <Modal visible={showCreateModal} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={styles.modalContent}>
            <View style={{ gap: 16 }}>
              <Text style={typography.h2}>Create new topic</Text>
              <TextInput
                placeholder="Topic name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={newTopicName}
                onChangeText={setNewTopicName}
                editable={!creatingTopic}
              />
              <TextInput
                placeholder="Description (optional)"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { height: 60 }]}
                multiline
                value={newTopicDesc}
                onChangeText={setNewTopicDesc}
                editable={!creatingTopic}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: colors.surfaceMuted, flex: 1 }]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewTopicName("");
                    setNewTopicDesc("");
                  }}
                  disabled={creatingTopic}
                >
                  <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={handleCreateTopic}
                  disabled={creatingTopic}
                >
                  <Text style={[typography.button, { color: "#fff" }]}>
                    {creatingTopic ? "Creating…" : "Create"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  empty: { paddingTop: 40, paddingHorizontal: 20 },
  modalContent: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 24,
    justifyContent: "flex-end",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  modalButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
});
