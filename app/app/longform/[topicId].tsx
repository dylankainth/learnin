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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { cleanLatexSymbols } from "@/lib/latexCleanup";
import type { LongformGradeResult, LongformQuestion } from "@/lib/types";

type Phase = "loading" | "writing" | "grading" | "feedback" | "complete";

const VERDICT_STYLE: Record<LongformGradeResult["verdict"], { bg: string; border: string; fg: string; label: string; emoji: string }> = {
  excellent: { bg: "#cbe1c3", border: "#519336", fg: "#255312", label: "Excellent!", emoji: "🌟" },
  good: { bg: "#dbe6f5", border: "#4a7fc4", fg: "#1c3d6b", label: "Good", emoji: "👍" },
  needs_work: { bg: "#f5eec6", border: "#c4a13e", fg: "#5c4a0a", label: "Needs work", emoji: "🤔" },
  incorrect: { bg: "#f5c6cc", border: "#dc3545", fg: "#420000", label: "Not quite", emoji: "📚" },
};

export default function LongformScreen() {
  const { topicId, documentId } = useLocalSearchParams<{ topicId: string; documentId?: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<LongformQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<LongformGradeResult | null>(null);
  const [results, setResults] = useState<LongformGradeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!topicId) return;
    api.review.longform
      .generate(topicId, documentId || undefined, 3)
      .then((res) => {
        setQuestions(res.questions);
        setPhase(res.questions.length > 0 ? "writing" : "complete");
      })
      .catch((err) => {
        setError(err?.message ?? "Couldn't generate questions");
        setPhase("complete");
      });
  }, [topicId]);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const canSubmit = answer.trim().length > 0;

  async function onSubmit() {
    if (!question) return;
    setPhase("grading");
    try {
      const graded = await api.review.longform.submit(question.id, answer.trim());
      setResult(graded);
      setResults((prev) => [...prev, graded]);
      setPhase("feedback");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't grade your answer");
      setPhase("writing");
    }
  }

  function onNext() {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (isLast) {
        setPhase("complete");
      } else {
        setIndex((i) => i + 1);
        setAnswer("");
        setResult(null);
        setPhase("writing");
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      }
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Writing your questions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Grading ──────────────────────────────────────────────────────────────
  if (phase === "grading") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Reading your answer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────
  if (phase === "complete") {
    const total = results.length;
    const avg = total > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0;

    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <View style={styles.completeWrap}>
          {error ? (
            <>
              <Text style={styles.completeEmoji}>⚠️</Text>
              <Text style={styles.completeLabel}>{error}</Text>
            </>
          ) : (
            <>
              <Text style={styles.completeEmoji}>{avg >= 85 ? "🌟" : avg >= 60 ? "👍" : avg >= 30 ? "🤔" : "📚"}</Text>
              <Text style={styles.completeScore}>{avg}</Text>
              <Text style={styles.completeLabel}>
                {total === 0
                  ? "No questions available yet"
                  : avg >= 85
                  ? "Excellent understanding!"
                  : avg >= 60
                  ? "Good effort!"
                  : avg >= 30
                  ? "Getting there — keep at it"
                  : "Keep studying and try again"}
              </Text>
              {total > 0 && (
                <View style={styles.savedBanner}>
                  <Text style={styles.savedText}>
                    ✍️  {total} long-answer question{total !== 1 ? "s" : ""} completed
                  </Text>
                </View>
              )}
            </>
          )}
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to studying</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Writing / Feedback ──────────────────────────────────────────────────
  const revealed = phase === "feedback" && result;
  const verdictStyle = revealed ? VERDICT_STYLE[result!.verdict] : null;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <View style={styles.dotsRow}>
          {questions.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive, i < index && styles.dotDone]}
            />
          ))}
        </View>
        <Text style={styles.progress}>{index + 1}/{questions.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Question */}
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>LONG ANSWER {index + 1}</Text>
            <Text style={styles.questionText}>{question ? cleanLatexSymbols(question.question) : ""}</Text>
          </View>

          {error && phase === "writing" && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Answer input */}
          <View style={styles.textInputWrap}>
            <TextInput
              style={[
                styles.textInput,
                revealed && { borderColor: verdictStyle!.border, backgroundColor: verdictStyle!.bg },
              ]}
              value={answer}
              onChangeText={setAnswer}
              placeholder="Write your answer in a few sentences…"
              placeholderTextColor="#aaa"
              multiline
              editable={phase === "writing"}
            />
          </View>

          {/* Submit button */}
          {phase === "writing" && (
            <Pressable
              style={[styles.checkBtn, !canSubmit && styles.checkBtnDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.checkBtnText}>Submit Answer</Text>
            </Pressable>
          )}

          {/* Feedback + next */}
          {revealed && (
            <View style={styles.revealSection}>
              <View style={[styles.resultBadge, { backgroundColor: verdictStyle!.bg }]}>
                <Text style={[styles.resultBadgeText, { color: verdictStyle!.fg }]}>
                  {verdictStyle!.emoji}  {verdictStyle!.label} · {result!.score}/100
                </Text>
              </View>

              <View style={styles.explanation}>
                <Text style={styles.explanationLabel}>FEEDBACK</Text>
                <Text style={styles.explanationText}>{cleanLatexSymbols(result!.feedback)}</Text>
              </View>

              {result!.strengths.length > 0 && (
                <View style={styles.explanation}>
                  <Text style={styles.explanationLabel}>WHAT YOU GOT RIGHT</Text>
                  {result!.strengths.map((s, i) => (
                    <Text key={i} style={styles.listItem}>•  {cleanLatexSymbols(s)}</Text>
                  ))}
                </View>
              )}

              {result!.missedPoints.length > 0 && (
                <View style={styles.explanation}>
                  <Text style={styles.explanationLabel}>WHAT YOU MISSED</Text>
                  {result!.missedPoints.map((s, i) => (
                    <Text key={i} style={styles.listItem}>•  {cleanLatexSymbols(s)}</Text>
                  ))}
                </View>
              )}

              <Pressable style={styles.checkBtn} onPress={onNext}>
                <Text style={styles.checkBtnText}>{isLast ? "Finish" : "Next Question"}</Text>
              </Pressable>
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

  errorBanner: {
    backgroundColor: "#f5c6cc",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: { fontFamily: "Figtree_500Medium", fontSize: 13, color: "#420000" },

  textInputWrap: { marginBottom: 20 },
  textInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    padding: 16,
    fontFamily: "Figtree_400Regular",
    fontSize: 15,
    color: "#111111",
    minHeight: 160,
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
  resultBadgeText: { fontFamily: "Figtree_700Bold", fontSize: 16 },

  explanation: {
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    padding: 14,
  },
  explanationLabel: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#78716C", letterSpacing: 1, marginBottom: 6 },
  explanationText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#333", lineHeight: 22 },
  listItem: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#333", lineHeight: 22 },

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
    textAlign: "center",
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
