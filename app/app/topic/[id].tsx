import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import type { Topic, DocumentSummary } from "@/lib/types";

const PAD = 20;

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
    } catch {
      setTopic({ id, name: "Loading...", created_at: new Date().toISOString(), content_count: 0, card_count: 0, due_count: 0 });
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  function confirmDeleteDocument(item: DocumentSummary) {
    Alert.alert(
      "Delete resource?",
      `"${item.title}" will be removed. Your study notes and cards generated from it won't be deleted automatically — you may want to review those too.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.documents.remove(item.id);
              setContents((prev) => prev.filter((c) => c.id !== item.id));
            } catch {
              Alert.alert("Error", "Could not delete the resource. Please try again.");
            }
          },
        },
      ]
    );
  }

  function confirmDeleteTopic() {
    if (!topic) return;
    Alert.alert(
      "Delete topic?",
      `"${topic.name}" and all its resources will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.topics.delete(topic.id);
              router.back();
            } catch {
              Alert.alert("Error", "Could not delete the topic. Please try again.");
            }
          },
        },
      ]
    );
  }

  if (!topic) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#111111" />
        </View>
      </SafeAreaView>
    );
  }

  const hasContent = contents.some((c) => c.status === "ready");
  const processingCount = contents.filter((c) => c.status === "pending" || c.status === "processing").length;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.headingRow}>
          <Text style={styles.heading}>{topic.name}</Text>
          <Pressable onPress={confirmDeleteTopic} hitSlop={8}>
            <Text style={styles.deleteTopicBtn}>Delete</Text>
          </Pressable>
        </View>
        {topic.description ? <Text style={styles.description}>{topic.description}</Text> : null}

        {/* Stat pills */}
        <View style={styles.statsRow}>
          <StatPill label="Items" value={topic.content_count} bg="#cbe1c3" fg="#255312" />
          <StatPill label="Cards" value={topic.card_count} bg="#cbc4e1" fg="#1f2184" />
          <StatPill label="Due" value={topic.due_count} bg="#ce9eaa" fg="#420000" />
        </View>

        {/* Primary action */}
        {hasContent && (
          <Pressable style={styles.btnDark} onPress={() => router.push({ pathname: "/study/[topicId]", params: { topicId: topic.id } })}>
            <Text style={styles.btnDarkText}>Study Now</Text>
          </Pressable>
        )}

        {/* Review due */}
        {topic.due_count > 0 && (
          <Pressable style={styles.btnLight} onPress={() => router.push({ pathname: "/review/session", params: { topicId: topic.id } })}>
            <Text style={styles.btnLightText}>Review {topic.due_count} due card{topic.due_count !== 1 ? "s" : ""}</Text>
          </Pressable>
        )}

        {/* Processing banner */}
        {processingCount > 0 && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color="#78716C" />
            <Text style={styles.processingText}>
              {processingCount} resource{processingCount !== 1 ? "s" : ""} still processing…
            </Text>
          </View>
        )}

        {/* Resources */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RESOURCES</Text>
          <Pressable onPress={() => router.push({ pathname: "/upload", params: { topicId: topic.id, hasContent: hasContent ? "true" : "false" } })}>
            <Text style={styles.sectionAction}>+ Add</Text>
          </Pressable>
        </View>

        {contents.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No content yet. Add a PDF or video to start studying.</Text>
          </View>
        ) : (
          contents.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.contentRow, pressed && { opacity: 0.7 }]}
              onLongPress={() => confirmDeleteDocument(item)}
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
                <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.contentSub}>{statusLabel(item.status)} · {item.card_count} cards</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: "/upload", params: { topicId: topic.id, hasContent: hasContent ? "true" : "false" } })}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function StatPill({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <View style={[styles.statPill, { backgroundColor: bg }]}>
      <Text style={[styles.statNum, { color: fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
    </View>
  );
}

function statusColor(status: DocumentSummary["status"]) {
  if (status === "ready") return "#519336";
  if (status === "error") return "#DC2626";
  return "#F59E0B";
}

function statusLabel(status: DocumentSummary["status"]) {
  if (status === "ready") return "Ready";
  if (status === "error") return "Error";
  if (status === "processing") return "Processing…";
  return "Pending";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: PAD, paddingBottom: 120, paddingTop: 8 },

  backBtn: { paddingVertical: 8, marginBottom: 4 },
  backText: { fontFamily: "Figtree_500Medium", fontSize: 14, color: "#78716C" },

  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heading: {
    fontFamily: "Figtree_700Bold",
    fontSize: 32,
    color: "#111111",
    letterSpacing: -0.5,
    flex: 1,
  },
  deleteTopicBtn: {
    fontFamily: "Figtree_500Medium",
    fontSize: 13,
    color: "#DC2626",
    paddingTop: 8,
    paddingLeft: 12,
  },
  description: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#78716C",
    marginBottom: 20,
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 8 },
  statPill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontFamily: "Figtree_700Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Figtree_400Regular",
    fontSize: 12,
  },

  btnDark: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  btnDarkText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },

  btnLight: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
  },
  btnLightText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111" },

  processingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  processingText: { fontFamily: "Figtree_400Regular", fontSize: 13, color: "#78716C" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionLabel: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#78716C", letterSpacing: 0.8 },
  sectionAction: { fontFamily: "Figtree_600SemiBold", fontSize: 13, color: "#111111" },

  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  contentTitle: { fontFamily: "Figtree_500Medium", fontSize: 14, color: "#111111" },
  contentSub: { fontFamily: "Figtree_400Regular", fontSize: 12, color: "#78716C", marginTop: 2 },
  chevron: { fontFamily: "Figtree_400Regular", fontSize: 18, color: "#78716C" },

  empty: { paddingTop: 24, alignItems: "center" },
  emptyText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#78716C", textAlign: "center" },

  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },
  fabText: { fontFamily: "Figtree_600SemiBold", fontSize: 28, color: "#FFFFFF", lineHeight: 34 },
});
