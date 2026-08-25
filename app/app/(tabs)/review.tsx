import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { accentFor } from "@/theme/colors";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import type { Topic, ReviewStats } from "@/lib/types";

const PAD = 8;

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(msUntil: number): string {
  const totalSeconds = Math.max(0, Math.floor(msUntil / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "< 1m";
}

export default function ReviewScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow(30_000);

  const load = useCallback(() => {
    Promise.all([api.topics.list(), api.review.stats()])
      .then(([t, s]) => {
        setTopics(t.topics.filter((topic) => topic.card_count > 0));
        setStats(s);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }

  const dueNow = Number(stats?.due_now ?? 0);
  const dueTopics = topics.filter((t) => Number(t.due_count) > 0);
  const lockedTopics = topics.filter(
    (t) => Number(t.due_count) === 0 && t.next_due_at
  );

  const listData: Topic[] = [...dueTopics, ...lockedTopics];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <FlatList
        data={listData}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>Review</Text>
            <Text style={styles.sub}>Pick a topic, or review everything due.</Text>

            {dueNow > 0 ? (
              <Pressable style={styles.allBtn} onPress={() => router.push("/review/session")}>
                <Text style={styles.allBtnText}>Review all  ·  {dueNow} due</Text>
              </Pressable>
            ) : (
              <View style={styles.nothingDue}>
                <Text style={styles.nothingDueText}>Nothing due right now — check back later.</Text>
              </View>
            )}

            {listData.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No cards yet. Add content to a topic to get started.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const accent = accentFor(item.name);
          const isLocked = Number(item.due_count) === 0;
          const msUntil = item.next_due_at ? new Date(item.next_due_at).getTime() - now : null;

          return (
            <Pressable
              style={[styles.tile, { backgroundColor: isLocked ? "#F5F4F0" : accent.bg }, isLocked && styles.tileLocked]}
              onPress={isLocked ? undefined : () => router.push({ pathname: "/review/session", params: { topicId: item.id } })}
              disabled={isLocked}
            >
              {isLocked ? (
                <>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={styles.tileNameLocked} numberOfLines={2}>{item.name}</Text>
                  {msUntil !== null && (
                    <Text style={styles.countdown}>{formatCountdown(msUntil)}</Text>
                  )}
                </>
              ) : (
                <>
                  <BlobMascot color={accent.fg} size={40} withFace={false} />
                  <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
                  <Text style={[styles.tileSub, { color: accent.fg }]}>{item.due_count} due</Text>
                </>
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { paddingHorizontal: PAD, paddingBottom: 100, paddingTop: 8, gap: 10 },

  heading: {
    fontFamily: "Figtree_700Bold",
    fontSize: 32,
    color: "#111111",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#78716C",
    marginBottom: 14,
  },

  allBtn: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  allBtnText: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  nothingDue: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  nothingDueText: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#78716C",
  },

  empty: { paddingVertical: 24 },
  emptyText: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#78716C",
    textAlign: "center",
  },

  tile: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    minHeight: 130,
    justifyContent: "center",
  },
  tileLocked: {
    opacity: 0.75,
  },
  tileName: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 14,
    color: "#111111",
    marginTop: 10,
    lineHeight: 20,
  },
  tileNameLocked: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 14,
    color: "#78716C",
    marginTop: 6,
    lineHeight: 20,
  },
  tileSub: {
    fontFamily: "Figtree_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  lockIcon: {
    fontSize: 22,
  },
  countdown: {
    fontFamily: "Figtree_700Bold",
    fontSize: 13,
    color: "#78716C",
    marginTop: 4,
  },
});
