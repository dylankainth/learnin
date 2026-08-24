import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors, accentFor } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import type { Topic } from "@/lib/types";

export default function TopicsScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.topics.list().then((t) => setTopics(t.topics)).catch(() => {});
    }, []),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={typography.h1}>Topics</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
          All your topics in one place.
        </Text>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 104, gap: 14 }}
        ListHeaderComponent={
          <Pressable style={styles.newCard} onPress={() => router.push("/create-topic")}>
            <Text style={[typography.h2, { color: "#fff" }]}>+ New topic</Text>
            <Text style={[typography.caption, { color: "rgba(255,255,255,0.7)" }]}>Upload a lecture or paste notes</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No topics yet — create one to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const accent = accentFor(item.name);
          return (
            <Pressable
              style={[styles.tile, { backgroundColor: accent.bg }]}
              onPress={() => router.push(`/topic/${item.id}`)}
            >
              <BlobMascot color={accent.fg} size={44} withFace={false} />
              <Text style={[typography.bodyMedium, { marginTop: 10 }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[typography.caption, { color: accent.fg, marginTop: 2 }]}>
                {item.content_count} items · {item.card_count} cards
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  newCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 4,
  },
  empty: { paddingVertical: 30 },
  tile: {
    flex: 1,
    borderRadius: radii.lg,
    padding: 16,
    minHeight: 130,
    justifyContent: "center",
  },
});
