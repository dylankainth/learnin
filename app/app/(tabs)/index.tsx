import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { StreakBadge } from "@/components/StreakBadge";
import { DeckCard } from "@/components/DeckCard";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { DocumentSummary, ReviewStats } from "@/lib/types";

export default function HomeScreen() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [docsRes, statsRes] = await Promise.all([api.documents.list(), api.review.stats()]);
    setDocuments(docsRes.documents);
    setStats(statsRes);
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
        data={documents}
        keyExtractor={(d) => d.id}
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

            <View style={styles.sectionHeaderRow}>
              <Text style={typography.h2}>Your lectures</Text>
              <Pressable onPress={() => router.push("/upload")}>
                <Text style={[typography.bodyMedium, { color: colors.primary }]}>+ Upload</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <DeckCard
            id={item.id}
            title={item.title}
            dueCount={Number(item.due_count)}
            cardCount={Number(item.card_count)}
            status={item.status}
            onPress={() => router.push(`/document/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No lectures yet. Upload a PDF or a recording to get your first study deck.
            </Text>
          </View>
        }
      />
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
});
