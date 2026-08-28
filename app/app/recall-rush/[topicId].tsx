import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";

/**
 * Recall Rush — rebuild the answer from a scrambled word bank, against a clock.
 *
 * Term Match trains recognition: with five pairs on screen, elimination does a
 * lot of the work. This game asks the learner to *produce* the answer instead —
 * the format that tends to yield the larger testing effect — but with tappable
 * word tiles rather than a text field, because typing a phrase under time
 * pressure on a phone is miserable.
 *
 * Distractor tiles are real words pulled from other answers in the same topic,
 * so the wrong options are plausible without ever showing the learner a
 * fabricated statement they might encode as true.
 *
 * Cleared first try → the SRS card is rated "got it" (4); anything else is
 * rated "struggled" (1), same contract as the quiz and Term Match.
 */

const MAX_ROUNDS = 8;
const SECONDS_PER_CARD = 25;
const STARTING_LIVES = 3;
const MIN_ANSWER_WORDS = 2;
const MAX_ANSWER_WORDS = 12;
const MAX_DISTRACTORS = 4;
const BASE_POINTS = 100;
const STREAK_STEP = 25;
const TIME_BONUS_PER_SECOND = 8;

type QuizCard = {
  id: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  question_type: string;
};

type Tile = { id: string; text: string };

type Round = {
  cardId: string;
  prompt: string;
  answerWords: string[];
  explanation: string;
  tiles: Tile[];
};

type Phase = "loading" | "empty" | "ready" | "playing" | "feedback" | "results";

function bestScoreKey(topicId: string) {
  return `@learnin/recallrush_best/${topicId}`;
}

function collapseWhitespace(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

/** Compare on letters and digits only, so punctuation never decides a round. */
function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(text: string) {
  return collapseWhitespace(text).split(" ").filter(Boolean);
}

/**
 * The comparable form of a word sequence. Tokens that are pure punctuation
 * ("=", "—") normalize to nothing and are dropped, so whether the learner
 * bothers to place them never decides a round.
 */
function sequenceOf(words: string[]) {
  return words.map(normalizeWord).filter(Boolean).join(" ");
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one round per usable card. Answers that are a single word give nothing
 * to reorder, and very long ones bury the screen in tiles, so both are skipped.
 */
function buildRounds(cards: QuizCard[]): Round[] {
  // Distractor pool: every reasonably distinctive word used across the topic's answers.
  const pool = new Map<string, string>();
  for (const card of cards) {
    for (const word of tokenize(card.answer)) {
      const key = normalizeWord(word);
      if (key.length > 3 && !pool.has(key)) pool.set(key, word);
    }
  }

  const rounds: Round[] = [];
  for (const card of cards) {
    const prompt = collapseWhitespace(card.question);
    const answerWords = tokenize(card.answer);
    if (!prompt || answerWords.length < MIN_ANSWER_WORDS || answerWords.length > MAX_ANSWER_WORDS) {
      continue;
    }

    const used = new Set(answerWords.map(normalizeWord));
    const distractors = shuffle([...pool.entries()].filter(([key]) => !used.has(key)))
      .slice(0, MAX_DISTRACTORS)
      .map(([, word]) => word);

    const tiles = shuffle([
      ...answerWords.map((text, i) => ({ id: `a${i}`, text })),
      ...distractors.map((text, i) => ({ id: `d${i}`, text })),
    ]);

    rounds.push({
      cardId: card.id,
      prompt,
      answerWords,
      explanation: card.explanation ?? "",
      tiles,
    });
  }

  return shuffle(rounds).slice(0, MAX_ROUNDS);
}

export default function RecallRushScreen() {
  const { topicId, documentId } = useLocalSearchParams<{ topicId: string; documentId?: string }>();

  const [phase, setPhase] = useState<Phase>("loading");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [wasCorrect, setWasCorrect] = useState(false);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_CARD);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [clearedCount, setClearedCount] = useState(0);

  const shake = useRef(new Animated.Value(0)).current;

  // Same pattern as Term Match: the countdown closure only re-binds on phase,
  // so anything it reads at zero lives in a ref rather than in state.
  const timeLeftRef = useRef(SECONDS_PER_CARD);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const indexRef = useRef(0);
  const roundsRef = useRef<Round[]>([]);
  const resultsRef = useRef<Map<string, 1 | 4>>(new Map());
  const settledRef = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;

    AsyncStorage.getItem(bestScoreKey(topicId))
      .then((raw) => {
        if (!cancelled && raw) setBestScore(Number(raw) || 0);
      })
      .catch(() => {});

    api.review
      .quiz(topicId, 10, documentId || undefined)
      .then((res) => {
        if (cancelled) return;
        const built = buildRounds(res.cards);
        if (built.length === 0) {
          setPhase("empty");
          return;
        }
        setRounds(built);
        roundsRef.current = built;
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("empty");
      });

    return () => {
      cancelled = true;
    };
  }, [topicId, documentId]);

  // ── Per-card countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const next = Math.max(0, timeLeftRef.current - 0.1);
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next <= 0) settleRound(false);
    }, 100);
    return () => clearInterval(id);
    // settleRound reads the round refs, so the closure needs no refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const round = rounds[index];
  const remainingTiles = round ? round.tiles.filter((t) => !placed.some((p) => p.id === t.id)) : [];
  const canSubmit = placed.length > 0;

  function startGame() {
    // Reshuffle the built rounds so a replay doesn't run the same order.
    const fresh = shuffle(rounds);
    setRounds(fresh);
    roundsRef.current = fresh;

    setIndex(0);
    setPlaced([]);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setLives(STARTING_LIVES);
    setClearedCount(0);
    setNewBest(false);
    setTimeLeft(SECONDS_PER_CARD);

    indexRef.current = 0;
    scoreRef.current = 0;
    streakRef.current = 0;
    livesRef.current = STARTING_LIVES;
    timeLeftRef.current = SECONDS_PER_CARD;
    resultsRef.current = new Map();
    settledRef.current = false;

    setPhase("playing");
  }

  function onTilePress(tile: Tile) {
    if (phase !== "playing") return;
    setPlaced((prev) => [...prev, tile]);
  }

  function onPlacedPress(tile: Tile) {
    if (phase !== "playing") return;
    setPlaced((prev) => prev.filter((t) => t.id !== tile.id));
  }

  function onClear() {
    if (phase !== "playing") return;
    setPlaced([]);
  }

  function onSubmit() {
    if (phase !== "playing" || !canSubmit) return;
    const current = roundsRef.current[indexRef.current];
    if (!current) return;
    const attempt = sequenceOf(placed.map((t) => t.text));
    const target = sequenceOf(current.answerWords);
    settleRound(attempt === target);
  }

  /** Score the current card, record its SRS rating, then advance or end. */
  function settleRound(correct: boolean) {
    if (settledRef.current) return;
    settledRef.current = true;

    const current = roundsRef.current[indexRef.current];
    if (!current) return;

    if (correct) {
      const nextStreak = streakRef.current + 1;
      const timeBonus = Math.round(timeLeftRef.current) * TIME_BONUS_PER_SECOND;
      const gained = BASE_POINTS + STREAK_STEP * (nextStreak - 1) + timeBonus;

      streakRef.current = nextStreak;
      scoreRef.current += gained;
      resultsRef.current.set(current.cardId, 4);

      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setScore(scoreRef.current);
      setClearedCount((c) => c + 1);
    } else {
      streakRef.current = 0;
      livesRef.current -= 1;
      resultsRef.current.set(current.cardId, 1);

      setStreak(0);
      setLives(livesRef.current);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    }

    setWasCorrect(correct);
    setPhase("feedback");
  }

  function onContinue() {
    const isLastCard = indexRef.current >= roundsRef.current.length - 1;
    if (livesRef.current <= 0 || isLastCard) {
      finishGame();
      return;
    }

    indexRef.current += 1;
    timeLeftRef.current = SECONDS_PER_CARD;
    settledRef.current = false;

    setIndex(indexRef.current);
    setPlaced([]);
    setTimeLeft(SECONDS_PER_CARD);
    setPhase("playing");
  }

  function finishGame() {
    const finalScore = scoreRef.current;

    if (topicId) {
      AsyncStorage.getItem(bestScoreKey(topicId))
        .then((raw) => {
          const previous = Number(raw) || 0;
          if (finalScore > previous) {
            setNewBest(true);
            setBestScore(finalScore);
            return AsyncStorage.setItem(bestScoreKey(topicId), String(finalScore));
          }
          setBestScore(previous);
        })
        .catch(() => {});
    }

    submitRatings();
    setPhase("results");
  }

  async function submitRatings() {
    const entries = [...resultsRef.current.entries()];
    await Promise.all(entries.map(([cardId, rating]) => api.review.submit(cardId, rating).catch(() => {})));
  }

  const timeFraction = timeLeft / SECONDS_PER_CARD;
  const timeLow = timeLeft <= 6;
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <Shell>
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Scrambling the words…</Text>
        </View>
      </Shell>
    );
  }

  // ── Not enough usable cards ──────────────────────────────────────────────
  if (phase === "empty") {
    return (
      <Shell>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>⚡</Text>
          <Text style={styles.emptyTitle}>Nothing to rebuild yet</Text>
          <Text style={styles.emptyBody}>
            Recall Rush needs answers between {MIN_ANSWER_WORDS} and {MAX_ANSWER_WORDS} words. Add a lecture to this
            topic and try again.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Back to studying</Text>
          </Pressable>
        </View>
      </Shell>
    );
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "ready") {
    return (
      <Shell>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Recall Rush</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigEmoji}>⚡</Text>
          <Text style={styles.introTitle}>Recall Rush</Text>
          <Text style={styles.introSub}>
            Rebuild each answer from scrambled words. {SECONDS_PER_CARD} seconds a card, {rounds.length} card
            {rounds.length !== 1 ? "s" : ""}, {STARTING_LIVES} lives.
          </Text>

          <View style={styles.rulesCard}>
            <Rule emoji="🧩" text="Tap words in order to build the answer. Tap a placed word to take it back." />
            <Rule emoji="🎣" text="Some words are decoys borrowed from other answers in this topic." />
            <Rule emoji="🔥" text={`Each correct answer chains a streak bonus of +${STREAK_STEP}.`} />
            <Rule emoji="❤️" text={`A wrong answer or a timeout costs a life. Lose ${STARTING_LIVES} and the run ends.`} />
          </View>

          {bestScore !== null && bestScore > 0 && (
            <Text style={styles.bestLine}>Your best on this topic: {bestScore.toLocaleString()}</Text>
          )}

          <Pressable style={styles.primaryBtn} onPress={startGame}>
            <Text style={styles.primaryBtnText}>Start run</Text>
          </Pressable>
        </ScrollView>
      </Shell>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (phase === "results") {
    const total = rounds.length;
    const struggled = [...resultsRef.current.values()].filter((r) => r === 1).length;
    const outOfLives = livesRef.current <= 0;

    return (
      <Shell>
        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigEmoji}>{struggled === 0 ? "🌟" : outOfLives ? "💔" : "🎉"}</Text>
          <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>
            {struggled === 0 ? "Perfect run!" : outOfLives ? "Out of lives" : "Run complete"}
          </Text>

          {newBest && (
            <View style={styles.newBestBanner}>
              <Text style={styles.newBestText}>🏆  New best score on this topic!</Text>
            </View>
          )}

          <View style={styles.statRow}>
            <StatBox label="Rebuilt" value={`${clearedCount}/${total}`} />
            <StatBox label="Best streak" value={`×${bestStreak}`} />
            <StatBox label="Lives left" value={String(Math.max(0, lives))} />
          </View>

          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>
              {struggled > 0
                ? `🔁  ${struggled} card${struggled !== 1 ? "s" : ""} saved for review — we'll bring them back sooner.`
                : "✅  Every answer reproduced from memory — that's the good kind of hard."}
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={startGame}>
            <Text style={styles.primaryBtnText}>Run it again</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Back to studying</Text>
          </Pressable>
        </ScrollView>
      </Shell>
    );
  }

  if (!round) return <Shell><View style={styles.center} /></Shell>;

  // ── Playing / feedback ───────────────────────────────────────────────────
  const showingFeedback = phase === "feedback";

  return (
    <Shell>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <Text style={styles.headerScore}>{score.toLocaleString()}</Text>
        <Text style={styles.hearts}>
          {"❤️".repeat(Math.max(0, lives))}
          <Text style={styles.heartsSpent}>{"🖤".repeat(Math.max(0, STARTING_LIVES - lives))}</Text>
        </Text>
      </View>

      <View style={styles.timerTrack}>
        <View
          style={[
            styles.timerFill,
            { width: `${Math.max(0, showingFeedback ? 0 : timeFraction) * 100}%` },
            timeLow && styles.timerFillLow,
          ]}
        />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Card {index + 1} of {rounds.length}</Text>
        <Text style={styles.metaText}>{streak >= 2 ? `🔥 ${streak} streak` : `${Math.ceil(timeLeft)}s`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.playScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>REBUILD THE ANSWER</Text>
          <Text style={styles.promptText}>{round.prompt}</Text>
        </View>

        {/* Answer construction area */}
        <Animated.View style={[styles.answerArea, { transform: [{ translateX }] }]}>
          {placed.length === 0 ? (
            <Text style={styles.answerPlaceholder}>Tap the words below in order…</Text>
          ) : (
            <View style={styles.wordWrap}>
              {placed.map((tile) => (
                <Pressable
                  key={tile.id}
                  style={[styles.word, styles.wordPlaced]}
                  onPress={() => onPlacedPress(tile)}
                  disabled={showingFeedback}
                >
                  <Text style={styles.wordPlacedText}>{tile.text}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Feedback */}
        {showingFeedback && (
          <View style={styles.feedbackWrap}>
            <View style={[styles.resultBadge, wasCorrect ? styles.resultCorrect : styles.resultWrong]}>
              <Text style={[styles.resultBadgeText, { color: wasCorrect ? "#255312" : "#420000" }]}>
                {wasCorrect ? "✓  Nailed it!" : "✗  Not quite"}
              </Text>
            </View>

            {!wasCorrect && (
              <View style={styles.answerReveal}>
                <Text style={styles.answerRevealLabel}>Correct answer</Text>
                <Text style={styles.answerRevealText}>{round.answerWords.join(" ")}</Text>
              </View>
            )}

            {round.explanation ? (
              <View style={styles.explanation}>
                <Text style={styles.explanationLabel}>WHY</Text>
                <Text style={styles.explanationText}>{round.explanation}</Text>
              </View>
            ) : null}

            <Pressable style={styles.primaryBtnWide} onPress={onContinue}>
              <Text style={styles.primaryBtnText}>
                {livesRef.current <= 0 || index >= rounds.length - 1 ? "See results" : "Next card"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Word bank */}
        {!showingFeedback && (
          <>
            <View style={styles.wordBank}>
              <View style={styles.wordWrap}>
                {remainingTiles.map((tile) => (
                  <Pressable key={tile.id} style={styles.word} onPress={() => onTilePress(tile)}>
                    <Text style={styles.wordText}>{tile.text}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.clearBtn} onPress={onClear} disabled={placed.length === 0}>
                <Text style={[styles.clearBtnText, placed.length === 0 && styles.dimmed]}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={onSubmit}
                disabled={!canSubmit}
              >
                <Text style={styles.submitBtnText}>Check</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </Shell>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      {children}
    </SafeAreaView>
  );
}

function Rule({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleEmoji}>{emoji}</Text>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 32 },
  loadingText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#78716C" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { padding: 4, minWidth: 56 },
  backText: { fontFamily: "Figtree_600SemiBold", fontSize: 18, color: "#78716C" },
  headerTitle: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111" },
  headerScore: { fontFamily: "Figtree_700Bold", fontSize: 22, color: "#111111", letterSpacing: -0.5 },
  hearts: { fontSize: 13, minWidth: 56, textAlign: "right" },
  heartsSpent: { opacity: 0.35 },

  timerTrack: {
    height: 5,
    backgroundColor: "#F5F4F0",
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: { height: 5, backgroundColor: "#111111", borderRadius: 3 },
  timerFillLow: { backgroundColor: "#dc3545" },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  metaText: { fontFamily: "Figtree_500Medium", fontSize: 12, color: "#78716C" },

  playScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },

  promptCard: {
    backgroundColor: "#F5F4F0",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  promptLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 11,
    color: "#78716C",
    letterSpacing: 1,
    marginBottom: 8,
  },
  promptText: {
    fontFamily: "Figtree_700Bold",
    fontSize: 18,
    color: "#111111",
    lineHeight: 26,
    letterSpacing: -0.2,
  },

  answerArea: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    borderStyle: "dashed",
    padding: 12,
    justifyContent: "center",
    marginBottom: 18,
  },
  answerPlaceholder: {
    fontFamily: "Figtree_400Regular",
    fontSize: 14,
    color: "#a8a29e",
    textAlign: "center",
  },

  wordWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  word: {
    backgroundColor: "#F5F4F0",
    borderWidth: 1.5,
    borderColor: "#E5E1D8",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  wordText: { fontFamily: "Figtree_500Medium", fontSize: 15, color: "#111111" },
  wordPlaced: { backgroundColor: "#E8E4F8", borderColor: "#7C3AED" },
  wordPlacedText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#4d3aa3" },

  wordBank: { marginBottom: 18 },

  actionRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  clearBtn: { paddingVertical: 16, paddingHorizontal: 20 },
  clearBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#78716C" },
  dimmed: { opacity: 0.35 },
  submitBtn: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },

  feedbackWrap: { gap: 14 },
  resultBadge: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  resultCorrect: { backgroundColor: "#cbe1c3" },
  resultWrong: { backgroundColor: "#f5c6cc" },
  resultBadgeText: { fontFamily: "Figtree_700Bold", fontSize: 16 },

  answerReveal: { backgroundColor: "#F5F4F0", borderRadius: 14, padding: 14 },
  answerRevealLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 11,
    color: "#78716C",
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  answerRevealText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111", lineHeight: 22 },

  explanation: { backgroundColor: "#F5F4F0", borderRadius: 14, padding: 14 },
  explanationLabel: {
    fontFamily: "Figtree_500Medium",
    fontSize: 11,
    color: "#78716C",
    letterSpacing: 1,
    marginBottom: 6,
  },
  explanationText: { fontFamily: "Figtree_400Regular", fontSize: 14, color: "#333", lineHeight: 22 },

  introScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 12,
  },
  bigEmoji: { fontSize: 64 },
  introTitle: { fontFamily: "Figtree_700Bold", fontSize: 30, color: "#111111", letterSpacing: -0.8 },
  introSub: {
    fontFamily: "Figtree_400Regular",
    fontSize: 15,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 23,
  },

  rulesCard: {
    backgroundColor: "#F5F4F0",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  ruleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ruleEmoji: { fontSize: 16, lineHeight: 22 },
  ruleText: { flex: 1, fontFamily: "Figtree_400Regular", fontSize: 14, color: "#333", lineHeight: 22 },
  bestLine: { fontFamily: "Figtree_500Medium", fontSize: 13, color: "#78716C", marginTop: 4 },

  emptyTitle: { fontFamily: "Figtree_700Bold", fontSize: 22, color: "#111111" },
  emptyBody: {
    fontFamily: "Figtree_400Regular",
    fontSize: 15,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 23,
  },

  scoreValue: {
    fontFamily: "Figtree_700Bold",
    fontSize: 60,
    color: "#111111",
    letterSpacing: -3,
    lineHeight: 68,
  },
  scoreLabel: { fontFamily: "Figtree_600SemiBold", fontSize: 20, color: "#111111", letterSpacing: -0.3 },

  newBestBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  newBestText: { fontFamily: "Figtree_600SemiBold", fontSize: 14, color: "#7c5a00" },

  statRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 8 },
  statBox: {
    flex: 1,
    backgroundColor: "#F5F4F0",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontFamily: "Figtree_700Bold", fontSize: 20, color: "#111111" },
  statLabel: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#78716C", letterSpacing: 0.5 },

  savedBanner: {
    backgroundColor: "#cbc4e1",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    marginTop: 4,
  },
  savedText: {
    fontFamily: "Figtree_500Medium",
    fontSize: 14,
    color: "#1f2184",
    lineHeight: 22,
    textAlign: "center",
  },

  primaryBtn: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 44,
    marginTop: 12,
  },
  primaryBtnWide: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#78716C" },
});
