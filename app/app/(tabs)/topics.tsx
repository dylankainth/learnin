import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { accentFor } from "@/theme/colors";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import { useOnReconnect } from "@/lib/connectivity";
import type { Topic } from "@/lib/types";

const PAD = 8;

export default function TopicsScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.topics.list().then((t) => setTopics(t.topics)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnReconnect(load);

  async function onRefresh() {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }

  function confirmDeleteTopic(item: Topic) {
    Alert.alert(
      "Delete topic?",
      `"${item.name}" and all its resources will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.topics.delete(item.id);
              setTopics((prev) => prev.filter((t) => t.id !== item.id));
            } catch {
              Alert.alert("Error", "Could not delete the topic. Please try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <FlatList
        data={topics}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>Topics</Text>
            <Text style={styles.sub}>All your topics in one place.</Text>

            <Pressable style={styles.newBtn} onPress={() => router.push("/create-topic")}>
              <Text style={styles.newBtnText}>+ New topic</Text>
            </Pressable>

            {topics.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No topics yet — create one to get started.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const accent = accentFor(item.name);
          return (
            <Pressable
              style={[styles.tile, { backgroundColor: accent.bg }]}
              onPress={() => router.push(`/topic/${item.id}`)}
              onLongPress={() => confirmDeleteTopic(item)}
            >
              <BlobMascot color={accent.fg} size={40} withFace={false} />
              <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
              <Text style={[styles.tileSub, { color: accent.fg }]}>
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

  newBtn: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  newBtnText: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
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
  tileName: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 14,
    color: "#111111",
    marginTop: 10,
    lineHeight: 20,
  },
  tileSub: {
    fontFamily: "Figtree_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
