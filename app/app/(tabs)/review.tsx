import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors, accentFor } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import type { Topic, ReviewStats } from "@/lib/types";

export default function ReviewScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.topics.list(), api.review.stats()])
        .then(([t, s]) => {
          setTopics(t.topics.filter((topic) => Number(topic.due_count) > 0));
          setStats(s);
        })
        .catch(() => {});
    }, []),
  );

  const dueNow = Number(stats?.due_now ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={typography.h1}>Review</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
          Pick a topic, or review everything due.
        </Text>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}
        ListHeaderComponent={
          dueNow > 0 ? (
            <Pressable style={styles.allCard} onPress={() => router.push("/review/session")}>
              <Text style={[typography.h2, { color: "#fff" }]}>Review everything</Text>
              <Text style={[typography.caption, { color: "#EAE3FB" }]}>{dueNow} cards due right now</Text>
            </Pressable>
          ) : (
            <View style={styles.emptyAll}>
              <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
                Nothing due right now — come back later or upload new content.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const accent = accentFor(item.name);
          return (
            <Pressable
              style={[styles.tile, { backgroundColor: accent.bg }]}
              onPress={() => router.push({ pathname: "/review/session", params: { topicId: item.id } })}
            >
              <BlobMascot color={accent.fg} size={44} withFace={false} />
              <Text style={[typography.bodyMedium, { marginTop: 10 }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: accent.fg, marginTop: 2 }]}>{item.due_count} due</Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  allCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 4,
  },
  emptyAll: { paddingVertical: 30 },
  tile: {
    flex: 1,
    borderRadius: radii.lg,
    padding: 16,
    minHeight: 130,
    justifyContent: "center",
  },
});
