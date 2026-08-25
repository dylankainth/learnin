import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";

const { width: W } = Dimensions.get("window");

type QuizCard = {
  id: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  question_type: string;
};

type Result = { cardId: string; rating: 1 | 4 };
type Phase = "loading" | "quiz" | "submitting" | "complete";

export default function QuizScreen() {
  const { topicId, documentId } = useLocalSearchParams<{ topicId: string; documentId?: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<QuizCard[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!topicId) return;
    api.review.quiz(topicId, 5, documentId || undefined)
      .then((res) => {
        setCards(res.cards);
        setPhase(res.cards.length > 0 ? "quiz" : "complete");
      })
      .catch(() => setPhase("complete"));
  }, [topicId]);

  const card = cards[index];
  const isMultiChoice = !!card?.options?.length;
  const isLastCard = index === cards.length - 1;
  const canCheck = revealed ? false : isMultiChoice ? !!selected : userText.trim().length > 0;

  function onReveal() {
    setRevealed(true);
  }

  function isCorrect() {
    if (!card) return false;
    if (isMultiChoice) return selected === card.answer;
    return userText.trim().toLowerCase() === card.answer.trim().toLowerCase();
  }

  function onRate(rating: 1 | 4) {
    const newResults = [...results, { cardId: card.id, rating }];
    setResults(newResults);

    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (isLastCard) {
        submitAll(newResults);
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
        setUserText("");
        setRevealed(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      }
    });
  }

  async function submitAll(allResults: Result[]) {
    setPhase("submitting");
    try {
      await Promise.all(allResults.map((r) => api.review.submit(r.cardId, r.rating)));
      const failedCount = allResults.filter((r) => r.rating === 1).length;
      if (failedCount > 0) {
        await api.notifications.quizComplete({ failedCount }).catch(() => {});
      }
    } catch {}
    setPhase("complete");
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Getting your questions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Submitting ───────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Saving your results…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────
  if (phase === "complete") {
    const correct = results.filter((r) => r.rating === 4).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const failed = total - correct;

    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.completeWrap}>
          <Text style={styles.completeEmoji}>{pct >= 80 ? "🌟" : pct >= 50 ? "💪" : "📚"}</Text>
          <Text style={styles.completeScore}>{correct}/{total}</Text>
          <Text style={styles.completeLabel}>
            {pct >= 80 ? "Excellent work!" : pct >= 50 ? "Good effort!" : "Keep practising!"}
          </Text>

          {failed > 0 && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedText}>
                🔁  {failed} card{failed !== 1 ? "s" : ""} saved for review — we'll remind you when your brain is ready.
              </Text>
            </View>
          )}

          {failed === 0 && total > 0 && (
            <View style={[styles.savedBanner, { backgroundColor: "#cbe1c3" }]}>
              <Text style={[styles.savedText, { color: "#255312" }]}>
                ✅  All cards reinforced — great memory!
              </Text>
            </View>
          )}

          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to studying</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  const correct = isCorrect();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <View style={styles.dotsRow}>
          {cards.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]}
            />
          ))}
        </View>
        <Text style={styles.progress}>{index + 1}/{cards.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>QUESTION {index + 1}</Text>
            <Text style={styles.questionText}>{card.question}</Text>
          </View>

          {/* Options / text input */}
          {isMultiChoice ? (
            <View style={styles.optionsWrap}>
              {card.options!.map((opt) => {
                let bg = "#F5F4F0";
                let border = "#F5F4F0";
                let textColor = "#111111";
                if (revealed) {
                  if (opt === card.answer) { bg = "#cbe1c3"; border = "#519336"; textColor = "#255312"; }
                  else if (opt === selected && opt !== card.answer) { bg = "#f5c6cc"; border = "#dc3545"; textColor = "#420000"; }
                } else if (opt === selected) {
                  bg = "#E8E4F8"; border = "#7C3AED"; textColor = "#4d3aa3";
                }
                return (
                  <Pressable
                    key={opt}
                    style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                    onPress={() => !revealed && setSelected(opt)}
                    disabled={revealed}
                  >
                    <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.textInputWrap}>
              <TextInput
                style={[
                  styles.textInput,
                  revealed && correct && { borderColor: "#519336", backgroundColor: "#cbe1c3" },
                  revealed && !correct && { borderColor: "#dc3545", backgroundColor: "#f5c6cc" },
                ]}
                value={userText}
                onChangeText={setUserText}
                placeholder="Type your answer…"
                placeholderTextColor="#aaa"
                multiline
                editable={!revealed}
              />
            </View>
          )}

          {/* Check button */}
          {!revealed && (
            <Pressable
              style={[styles.checkBtn, !canCheck && styles.checkBtnDisabled]}
              onPress={onReveal}
              disabled={!canCheck}
            >
              <Text style={styles.checkBtnText}>Check Answer</Text>
            </Pressable>
          )}

          {/* Explanation + rating */}
          {revealed && (
            <View style={styles.revealSection}>
              <View style={[styles.resultBadge, correct ? styles.resultCorrect : styles.resultWrong]}>
                <Text style={[styles.resultBadgeText, { color: correct ? "#255312" : "#420000" }]}>
                  {correct ? "✓  Correct!" : "✗  Not quite"}
                </Text>
              </View>

              {!correct && (
                <View style={styles.answerReveal}>
                  <Text style={styles.answerRevealLabel}>Correct answer</Text>
                  <Text style={styles.answerRevealText}>{card.answer}</Text>
                </View>
              )}

              {card.explanation ? (
                <View style={styles.explanation}>
                  <Text style={styles.explanationLabel}>WHY</Text>
                  <Text style={styles.explanationText}>{card.explanation}</Text>
                </View>
              ) : null}

              <Text style={styles.rateLabel}>How did that feel?</Text>
              <View style={styles.rateRow}>
                <Pressable style={[styles.rateBtn, styles.rateBtnStruggled]} onPress={() => onRate(1)}>
                  <Text style={styles.rateBtnEmoji}>😓</Text>
                  <Text style={[styles.rateBtnText, { color: "#420000" }]}>Struggled</Text>
                </Pressable>
                <Pressable style={[styles.rateBtn, styles.rateBtnGotIt]} onPress={() => onRate(4)}>
                  <Text style={styles.rateBtnEmoji}>💪</Text>
                  <Text style={[styles.rateBtnText, { color: "#255312" }]}>Got it!</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#78716C" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontFamily: "Figtree_600SemiBold", fontSize: 18, color: "#78716C" },
  dotsRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5E1D8" },
  dotActive: { backgroundColor: "#111111", width: 20 },
  dotDone: { backgroundColor: "#519336" },
  progress: { fontFamily: "Figtree_500Medium", fontSize: 13, color: "#78716C" },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 8 },

  questionCard: {
    backgroundColor: "#F5F4F0",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  questionLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 11,
    color: "#78716C",
    letterSpacing: 1,
    marginBottom: 10,
  },
  questionText: {
    fontFamily: "Figtree_700Bold",
    fontSize: 20,
    color: "#111111",
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  optionsWrap: { gap: 10, marginBottom: 20 },
  option: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
  },
  optionText: { fontFamily: "Figtree_500Medium", fontSize: 15, lineHeight: 22 },

  textInputWrap: { marginBottom: 20 },
  textInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    padding: 16,
    fontFamily: "Figtree_400Regular",
    fontSize: 15,
    color: "#111111",
    minHeight: 100,
    textAlignVertical: "top",
  },

  checkBtn: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  checkBtnDisabled: { opacity: 0.35 },
  checkBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },

  revealSection: { gap: 14 },
  resultBadge: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  resultCorrect: { backgroundColor: "#cbe1c3" },
  resultWrong: { backgroundColor: "#f5c6cc" },
  resultBadgeText: { fontFamily: "Figtree_700Bold", fontSize: 16 },

  answerReveal: {
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    padding: 14,
  },
  answerRevealLabel: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#78716C", marginBottom: 4, letterSpacing: 0.8 },
  answerRevealText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111" },

  explanation: {
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    padding: 14,
  },
  explanationLabel: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#78716C", letterSpacing: 1, marginBottom: 6 },
  explanationText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#333", lineHeight: 22 },

  rateLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 13,
    color: "#78716C",
    textAlign: "center",
    marginTop: 4,
  },
  rateRow: { flexDirection: "row", gap: 12 },
  rateBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
  },
  rateBtnStruggled: { backgroundColor: "#fce8ea", borderColor: "#f5c6cc" },
  rateBtnGotIt: { backgroundColor: "#cbe1c3", borderColor: "#a3d08f" },
  rateBtnEmoji: { fontSize: 24 },
  rateBtnText: { fontFamily: "Figtree_700Bold", fontSize: 14 },

  // Complete screen
  completeWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  completeEmoji: { fontSize: 72 },
  completeScore: {
    fontFamily: "Figtree_700Bold",
    fontSize: 64,
    color: "#111111",
    letterSpacing: -3,
    lineHeight: 72,
  },
  completeLabel: {
    fontFamily: "Figtree_600SemiBold",
    fontSize: 22,
    color: "#111111",
    letterSpacing: -0.3,
  },
  savedBanner: {
    backgroundColor: "#cbc4e1",
    borderRadius: 14,
    padding: 16,
    width: "100%",
  },
  savedText: {
    fontFamily: "Figtree_500Medium",
    fontSize: 14,
    color: "#1f2184",
    lineHeight: 22,
    textAlign: "center",
  },
  doneBtn: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  doneBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },
});
