import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { BlobMascot } from "@/components/BlobMascot";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { InlineQuiz } from "@/components/InlineQuiz";
import { api } from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";

export default function DocumentReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await api.documents.get(id);
      if (cancelled) return;
      setDetail(data);
      if (data.document.status === "processing" || data.document.status === "pending") {
        pollRef.current = setTimeout(load, 3000);
      }
    }
    load().catch(() => {});

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [id]);

  if (!detail) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const { document, blocks } = detail;

  if (document.status !== "ready") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header title={document.title} onClose={() => router.back()} />
        <View style={styles.center}>
          <BlobMascot color={colors.blue} size={80} mood={document.status === "error" ? "sleepy" : "excited"} />
          <Text style={[typography.h2, { marginTop: 18, textAlign: "center" }]}>
            {document.status === "error" ? "Something went wrong" : "Building your explainer & quizzes…"}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
            {document.status === "error"
              ? document.errorMessage ?? "Please try uploading again."
              : "This usually takes a minute or two for a full lecture."}
          </Text>
          {document.status !== "error" && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={document.title}
        onClose={() => router.back()}
        onChat={() => router.push({ pathname: "/chat/[documentId]", params: { documentId: id, documentTitle: document.title } })}
      />
      <FlatList
        data={blocks}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          item.type === "explainer" ? <InlineMarkdown text={item.markdown} /> : <InlineQuiz block={item} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
      />
    </SafeAreaView>
  );
}

function Header({ title, onClose, onChat }: { title: string; onClose: () => void; onChat: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={12}>
        <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
      </Pressable>
      <Text style={[typography.h2, { flex: 1, marginLeft: 14 }]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable onPress={onChat} hitSlop={12}>
        <Text style={[typography.bodyMedium, { color: colors.primary }]}>💬</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
});
