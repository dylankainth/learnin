import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { DeckCard } from "@/components/DeckCard";
import { api } from "@/lib/api";
import type { Topic, DocumentSummary } from "@/lib/types";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [contents, setContents] = useState<DocumentSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.topics.get(id);
      setTopic(res.topic);
      setContents(res.contents);
    } catch (err) {
      console.error("Failed to load topic:", err);
      // For new topics, create a placeholder while content loads
      setTopic({
        id,
        name: "Loading...",
        created_at: new Date().toISOString(),
        content_count: 0,
        card_count: 0,
        due_count: 0,
      });
    }
  }, [id]);

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

  if (!topic) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={typography.body}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <FlatList
        data={contents}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={[typography.body, { color: colors.primary }]}>← Back</Text>
            </Pressable>
            <View>
              <Text style={typography.h1}>{topic.name}</Text>
              {topic.description && <Text style={[typography.body, { color: colors.textMuted }]}>{topic.description}</Text>}
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
                {topic.content_count} item{topic.content_count !== 1 ? "s" : ""} • {topic.card_count} cards
              </Text>
            </View>

            {topic.due_count > 0 && (
              <Pressable
                style={styles.reviewCta}
                onPress={() => router.push({ pathname: "/review/session", params: { topicId: topic.id } })}
              >
                <Text style={[typography.button, { color: "#fff" }]}>Review {topic.due_count} due card{topic.due_count !== 1 ? "s" : ""}</Text>
              </Pressable>
            )}

            {contents.length > 0 && <Text style={[typography.caption, { color: colors.textMuted }]}>CONTENT</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <DeckCard
            id={item.id}
            title={item.title}
            dueCount={Number(item.due_count)}
            cardCount={Number(item.card_count)}
            status={item.status}
            onPress={() => router.push({ pathname: `/document/${item.id}`, params: { topicId: topic.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No content yet. Add a PDF, video, or document to this topic.
            </Text>
            <Pressable style={styles.addButton} onPress={() => router.push({ pathname: "/upload", params: { topicId: topic.id } })}>
              <Text style={[typography.button, { color: colors.primary }]}>+ Add Content</Text>
            </Pressable>
          </View>
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: "/upload", params: { topicId: topic.id } })}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  backButton: { paddingVertical: 8 },
  reviewCta: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  empty: { paddingTop: 40, paddingHorizontal: 20, alignItems: "center", gap: 16 },
  addButton: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 28, color: "#fff", fontWeight: "600" },
});
