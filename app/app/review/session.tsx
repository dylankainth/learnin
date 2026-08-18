import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import type { DueCard } from "@/lib/types";

const RATINGS: { label: string; value: 1 | 2 | 3 | 4; color: string }[] = [
  { label: "Again", value: 1, color: colors.danger },
  { label: "Hard", value: 2, color: colors.orange },
  { label: "Good", value: 3, color: colors.blue },
  { label: "Easy", value: 4, color: colors.success },
];

export default function ReviewSession() {
  const { documentId } = useLocalSearchParams<{ documentId?: string }>();
  const [cards, setCards] = useState<DueCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.review.due(50, documentId).then((r) => setCards(r.cards)).catch(() => setCards([]));
  }, [documentId]);

  if (!cards) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (cards.length === 0 || index >= cards.length) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <BlobMascot color={colors.teal} size={100} mood="excited" />
          <Text style={[typography.h1, { marginTop: 20, textAlign: "center" }]}>
            {cards.length === 0 ? "Nothing due right now" : "All caught up!"}
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
            {cards.length === 0 ? "Come back later, or upload a new lecture." : `You reviewed ${cards.length} cards. Nice work.`}
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={[typography.button, { color: "#fff" }]}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const card = cards[index];

  async function submitRating(rating: 1 | 2 | 3 | 4) {
    setSubmitting(true);
    try {
      await api.review.submit(card.id, rating);
      setIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.wrap}>
        <View style={styles.progressRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(index / cards.length) * 100}%` }]} />
          </View>
        </View>

        <Text style={[typography.caption, { color: colors.primary, marginTop: 24 }]}>{card.document_title.toUpperCase()}</Text>
        <Text style={[typography.h1, { marginTop: 8 }]}>{card.question}</Text>

        <View style={{ marginTop: 24, gap: 12 }}>
          {card.options ? (
            card.options.map((opt) => {
              const isSelected = selected === opt;
              const showCorrect = revealed && opt === card.answer;
              const showWrong = revealed && isSelected && opt !== card.answer;
              return (
                <Pressable
                  key={opt}
                  disabled={revealed}
                  onPress={() => setSelected(opt)}
                  style={[
                    styles.option,
                    isSelected && !revealed && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    showCorrect && { borderColor: colors.success, backgroundColor: colors.tealLight },
                    showWrong && { borderColor: colors.danger, backgroundColor: "#FDE4E8" },
                  ]}
                >
                  <Text style={typography.body}>{opt}</Text>
                </Pressable>
              );
            })
          ) : revealed ? (
            <View style={styles.answerBox}>
              <Text style={typography.bodyMedium}>{card.answer}</Text>
            </View>
          ) : (
            <Pressable style={styles.revealPrompt} onPress={() => setRevealed(true)}>
              <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Tap to reveal the answer</Text>
            </Pressable>
          )}
        </View>

        {revealed && (
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 16 }]}>{card.explanation}</Text>
        )}

        <View style={{ marginTop: "auto" }}>
          {!revealed ? (
            <Pressable
              style={[styles.checkBtn, !selected && !card.options && { opacity: 1 }, card.options && !selected && { opacity: 0.5 }]}
              disabled={card.options ? !selected : false}
              onPress={() => setRevealed(true)}
            >
              <Text style={[typography.button, { color: "#fff" }]}>Check</Text>
            </Pressable>
          ) : (
            <View style={styles.ratingRow}>
              {RATINGS.map((r) => (
                <Pressable
                  key={r.value}
                  disabled={submitting}
                  onPress={() => submitRating(r.value)}
                  style={[styles.ratingBtn, { backgroundColor: r.color, opacity: submitting ? 0.6 : 1 }]}
                >
                  <Text style={[typography.caption, { color: "#fff" }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  option: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, padding: 16, backgroundColor: colors.surface },
  answerBox: { backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: 16 },
  revealPrompt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radii.md,
    padding: 20,
    alignItems: "center",
  },
  checkBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 16, alignItems: "center" },
  ratingRow: { flexDirection: "row", gap: 10 },
  ratingBtn: { flex: 1, borderRadius: radii.pill, paddingVertical: 14, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  doneBtn: { marginTop: 28, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 32, paddingVertical: 14 },
});
