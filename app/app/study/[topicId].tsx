import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii, fonts } from "@/theme/typography";
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
      // not critical
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
        <Header title="Study" topicId={topicId ?? ""} />
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
      <Header title={detail.topic.name} topicId={topicId ?? ""} />

      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        {detail.blocks.map((block, index) =>
          block.type === "explainer" ? (
            <ExplainerItem
              key={block.id}
              block={block}
              onLock={() => onLockBlock(block.id)}
            />
          ) : (
            <QuizItem key={block.id} block={block} />
          ),
        )}

        {detail.processingCount > 0 && (
          <View style={styles.processingFooter}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 8 }]}>
              {detail.processingCount} more lecture{detail.processingCount !== 1 ? "s" : ""} processing…
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ExplainerItem({ block, onLock }: { block: TopicBlock; onLock: () => void }) {
  return (
    <View style={styles.section}>
      <InlineMarkdown text={block.markdown ?? ""} />
    </View>
  );
}

function QuizItem({ block }: { block: TopicBlock }) {
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
  return (
    <View style={styles.quizWrap}>
      <View style={styles.quizRule} />
      <Text style={styles.quizLabel}>Check your understanding</Text>
      <InlineQuiz block={quizBlock} />
      <View style={styles.quizRule} />
    </View>
  );
}

function Header({ title, topicId }: { title: string; topicId: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={[typography.bodyMedium, { color: colors.primary }]}>← Back</Text>
      </Pressable>
      <Text style={[typography.caption, { flex: 1, textAlign: "center", color: colors.textMuted }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 48 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  page: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  section: {
    marginBottom: 8,
  },
  quizWrap: {
    marginVertical: 8,
  },
  quizRule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  quizLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  processingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
});
