import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { InlineQuiz } from "@/components/InlineQuiz";
import { api } from "@/lib/api";
import type { TopicBlock, TopicStudyDetail } from "@/lib/types";

export default function TopicStudyScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [detail, setDetail] = useState<TopicStudyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!topicId) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.topics.study(topicId);
      setDetail(data);
      if (data.processingCount > 0) {
        pollRef.current = setTimeout(() => load(true), 5000);
      }
    } catch (err) {
      console.error("Failed to load study content:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [topicId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (pollRef.current) clearTimeout(pollRef.current);
      };
    }, [load]),
  );

  async function onLockBlock(blockId: string) {
    try {
      await api.blocks.lock(blockId);
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, locked: true } : b)),
        };
      });
    } catch {
      // silently ignore — not critical
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || detail.blocks.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title="Study" onClose={() => router.back()} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
          {detail?.processingCount ? (
            <>
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={[typography.h2, { textAlign: "center" }]}>Building your study material…</Text>
              <Text style={[typography.body, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
                {detail.processingCount} lecture{detail.processingCount !== 1 ? "s" : ""} still processing.
              </Text>
            </>
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No content yet. Add a PDF or video from the topic page.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={detail.topic.name} onClose={() => router.back()} />

      <FlatList
        data={detail.blocks}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <BlockItem block={item} onLock={() => onLockBlock(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        ListFooterComponent={
          detail.processingCount > 0 ? (
            <View style={styles.processingFooter}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 8 }]}>
                {detail.processingCount} more lecture{detail.processingCount !== 1 ? "s" : ""} still processing…
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function BlockItem({ block, onLock }: { block: TopicBlock; onLock: () => void }) {
  if (block.type === "explainer") {
    return (
      <View>
        <InlineMarkdown text={block.markdown ?? ""} />
        {!block.locked && (
          <Pressable style={styles.markRead} onPress={onLock}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>✓ Mark as read</Text>
          </Pressable>
        )}
        {block.locked && (
          <View style={styles.lockedBadge}>
            <Text style={[typography.caption, { color: colors.success }]}>✓ Read</Text>
          </View>
        )}
      </View>
    );
  }

  // Quiz block — cast to what InlineQuiz expects
  const quizBlock = {
    id: block.id,
    type: "quiz" as const,
    question: block.question ?? "",
    options: block.options ?? null,
    answer: block.answer ?? "",
    explanation: block.explanation ?? "",
    cardId: block.cardId,
    dueAt: block.dueAt,
    reps: block.reps,
  };
  return <InlineQuiz block={quizBlock} />;
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={12}>
        <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
      </Pressable>
      <Text style={[typography.h2, { flex: 1, marginLeft: 14 }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 80 },
  markRead: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
  },
  lockedBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  processingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
});
