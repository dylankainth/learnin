import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { api } from "@/lib/api";
import type { Topic, DocumentSummary } from "@/lib/types";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [contents, setContents] = useState<DocumentSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const openingPdf = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.topics.get(id);
      setTopic(res.topic);
      setContents(res.contents);
    } catch (err) {
      console.error("Failed to load topic:", err);
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
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasContent = contents.some((c) => c.status === "ready");
  const processingCount = contents.filter((c) => c.status === "pending" || c.status === "processing").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={[typography.body, { color: colors.primary }]}>← Back</Text>
        </Pressable>

        {/* Header */}
        <View style={{ marginTop: 4, marginBottom: 24 }}>
          <Text style={typography.h1}>{topic.name}</Text>
          {topic.description ? (
            <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>{topic.description}</Text>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill label="Items" value={topic.content_count} />
          <StatPill label="Cards" value={topic.card_count} />
          <StatPill label="Due" value={topic.due_count} accent={topic.due_count > 0} />
        </View>

        {/* Study Now button */}
        {hasContent && (
          <Pressable
            style={styles.studyBtn}
            onPress={() => router.push({ pathname: "/study/[topicId]", params: { topicId: topic.id } })}
          >
            <Text style={[typography.button, { color: "#fff", fontSize: 18 }]}>Study Now</Text>
          </Pressable>
        )}

        {/* Review due cards */}
        {topic.due_count > 0 && (
          <Pressable
            style={styles.reviewCta}
            onPress={() => router.push({ pathname: "/review/session", params: { topicId: topic.id } })}
          >
            <Text style={[typography.button, { color: colors.primary }]}>
              Review {topic.due_count} due card{topic.due_count !== 1 ? "s" : ""}
            </Text>
          </Pressable>
        )}

        {/* Processing indicator */}
        {processingCount > 0 && (
          <View style={styles.processingBanner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 8 }]}>
              {processingCount} resource{processingCount !== 1 ? "s" : ""} still processing…
            </Text>
          </View>
        )}

        {/* Content list */}
        <View style={{ marginTop: 24 }}>
          <View style={styles.sectionHeader}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>RESOURCES</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/upload",
                  params: { topicId: topic.id, hasContent: hasContent ? "true" : "false" },
                })
              }
            >
              <Text style={[typography.caption, { color: colors.primary }]}>+ Add</Text>
            </Pressable>
          </View>

          {contents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
                No content yet. Add a PDF or video to start studying.
              </Text>
            </View>
          ) : (
            contents.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.contentRow, pressed && { opacity: 0.7 }]}
                onPress={async () => {
                  if (item.source_type === "pdf") {
                    if (openingPdf.current.has(item.id)) return;
                    openingPdf.current.add(item.id);
                    try {
                      const url = item.file_url ?? (await api.documents.get(item.id)).document.fileUrl;
                      if (url) await Linking.openURL(url);
                      else router.push({ pathname: "/document/[id]", params: { id: item.id } });
                    } catch {
                      router.push({ pathname: "/document/[id]", params: { id: item.id } });
                    } finally {
                      openingPdf.current.delete(item.id);
                    }
                  } else {
                    router.push({ pathname: "/document/[id]", params: { id: item.id } });
                  }
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodyMedium} numberOfLines={1}>{item.title}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {statusLabel(item.status)} • {item.card_count} cards
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: "/upload",
            params: { topicId: topic.id, hasContent: hasContent ? "true" : "false" },
          })
        }
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[styles.statPill, accent && { backgroundColor: colors.primaryLight }]}>
      <Text style={[typography.h2, { color: accent ? colors.primary : colors.text }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function statusColor(status: DocumentSummary["status"]) {
  if (status === "ready") return colors.success;
  if (status === "error") return colors.danger;
  return colors.orange;
}

function statusLabel(status: DocumentSummary["status"]) {
  if (status === "ready") return "Ready";
  if (status === "error") return "Error";
  if (status === "processing") return "Processing…";
  return "Pending";
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  backButton: { paddingVertical: 8 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    gap: 2,
  },
  studyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  reviewCta: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  processingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 4,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  empty: { paddingTop: 24, paddingHorizontal: 16, alignItems: "center" },
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
