import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { DeckCard } from "@/components/DeckCard";
import { api } from "@/lib/api";
import type { DocumentSummary } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function LibraryScreen() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.documents.list().then((r) => setDocuments(r.documents)).catch(() => {});
    }, []),
  );

  const totalCards = documents.reduce((sum, d) => sum + Number(d.card_count), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={typography.h1}>Library</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
          {documents.length} lecture{documents.length === 1 ? "" : "s"} · {totalCards} cards total
        </Text>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 6 }]}>{formatDate(item.created_at)}</Text>
            <DeckCard
              id={item.id}
              title={item.title}
              dueCount={Number(item.due_count)}
              cardCount={Number(item.card_count)}
              status={item.status}
              onPress={() => router.push(`/document/${item.id}`)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingTop: 40 }}>
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              Nothing uploaded yet.
            </Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push("/upload")}>
        <Text style={{ color: "#fff", fontSize: 28, marginTop: -2 }}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
