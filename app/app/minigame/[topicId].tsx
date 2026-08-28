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
 * Term Match — a 60 second rapid-recall minigame.
 *
 * Five prompts and five answers are laid out side by side in scrambled order.
 * Tap a prompt, then the answer you think belongs to it. Matching a pair on the
 * first attempt rates the underlying SRS card as "got it" (4); a pair that took
 * a wrong guess is rated "struggled" (1), so a round feeds the same scheduler
 * the quiz does.
 */

const ROUND_SECONDS = 60;
const PAIRS_PER_ROUND = 5;
const ROUNDS_PER_SET = 5;
const NEXT_ROUND_DELAY = 550;
const WRONG_TIME_PENALTY = 3;
const BASE_POINTS = 100;
const COMBO_STEP = 25;
const WRONG_POINTS = 25;
const TIME_BONUS_PER_SECOND = 10;
const INTRO_SEEN_KEY = "@learnin/minigame_intro_seen";

type QuizCard = {
  id: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  question_type: string;
};

type Pair = {
  cardId: string;
  prompt: string;
  answer: string;
};

type Tile = {
  key: string;
  cardId: string;
  side: "prompt" | "answer";
  text: string;
};

type Phase = "loading" | "empty" | "ready" | "playing" | "results";
type TileState = "idle" | "selected" | "wrong" | "matched";

function bestScoreKey(topicId: string) {
  return `@learnin/minigame_best/${topicId}`;
}

/** Strip cloze blanks / trailing whitespace so prompts read cleanly in a small tile. */
function cleanText(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
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
 * Pick the cards that read best as tiles: short prompt + short answer, with
 * distinct answers so a round is never ambiguous.
 */
function buildPairs(cards: QuizCard[]): Pair[] {
  const seenAnswers = new Set<string>();
  const candidates: Pair[] = [];

  for (const card of cards) {
    const prompt = cleanText(card.question);
    const answer = cleanText(card.answer);
    if (!prompt || !answer) continue;
    const dedupeKey = answer.toLowerCase();
    if (seenAnswers.has(dedupeKey)) continue;
    seenAnswers.add(dedupeKey);
    candidates.push({ cardId: card.id, prompt, answer });
  }

  // Shortest combined length first — those fit the tiles without truncation.
  candidates.sort((a, b) => a.prompt.length + a.answer.length - (b.prompt.length + b.answer.length));
  // Keep a little more than a round's worth so replays aren't always identical.
  return candidates.slice(0, PAIRS_PER_ROUND * 2);
}

export default function MinigameScreen() {
  const { topicId, documentId } = useLocalSearchParams<{ topicId: string; documentId?: string }>();

  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<Pair[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [promptTiles, setPromptTiles] = useState<Tile[]>([]);
  const [answerTiles, setAnswerTiles] = useState<Tile[]>([]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [missedCardIds, setMissedCardIds] = useState<string[]>([]);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [sessionMatched, setSessionMatched] = useState(0);
  const [sessionMissed, setSessionMissed] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const shakeValues = useRef<Map<string, Animated.Value>>(new Map());
  const lockRef = useRef(false);
  const finishedRef = useRef(false);

  // The countdown fires from an interval whose closure only re-binds on `phase`,
  // so the values a round ends on are mirrored in refs rather than read as state.
  const timeLeftRef = useRef(ROUND_SECONDS);
  const scoreRef = useRef(0);
  const matchedRef = useRef<string[]>([]);
  const missedRef = useRef<string[]>([]);
  const pairsRef = useRef<Pair[]>([]);
  const roundIndexRef = useRef(0);
  const sessionResultsRef = useRef<Map<string, 1 | 4>>(new Map());
  const sessionMatchedRef = useRef(0);
  const sessionMissedRef = useRef(0);
  const sessionTotalRef = useRef(0);

  const getShake = useCallback((key: string) => {
    let value = shakeValues.current.get(key);
    if (!value) {
      value = new Animated.Value(0);
      shakeValues.current.set(key, value);
    }
    return value;
  }, []);

  // ── Load cards ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;

    Promise.all([
      AsyncStorage.getItem(bestScoreKey(topicId)).catch(() => null),
      AsyncStorage.getItem(INTRO_SEEN_KEY).catch(() => null),
      api.review.quiz(topicId, 10, documentId || undefined).catch(() => null),
    ]).then(([bestRaw, introRaw, res]) => {
      if (cancelled) return;
      if (bestRaw) setBestScore(Number(bestRaw) || 0);

      if (!res) {
        setPhase("empty");
        return;
      }
      const built = buildPairs(res.cards);
      if (built.length < 2) {
        setPhase("empty");
        return;
      }
      setPool(built);
      setPairs(built.slice(0, PAIRS_PER_ROUND));

      if (introRaw) {
        startSet(built);
      } else {
        setPhase("ready");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [topicId, documentId]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const next = Math.max(0, timeLeftRef.current - 0.1);
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next <= 0) finishRound("timeout");
    }, 100);
    return () => clearInterval(id);
    // finishRound reads the round refs, so it needs no closure refresh here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function dealRoundTiles(source: Pair[]) {
    setPromptTiles(
      shuffle(
        source.map<Tile>((p) => ({ key: `p:${p.cardId}`, cardId: p.cardId, side: "prompt", text: p.prompt })),
      ),
    );
    setAnswerTiles(
      shuffle(
        source.map<Tile>((p) => ({ key: `a:${p.cardId}`, cardId: p.cardId, side: "answer", text: p.answer })),
      ),
    );
  }

  // Re-draw from the pool so a round (or a replay) isn't always the same five pairs.
  function drawRound(source: Pair[]): Pair[] {
    return shuffle(source).slice(0, PAIRS_PER_ROUND);
  }

  /** Starts a fresh set of ROUNDS_PER_SET rounds, back to back. */
  function startSet(poolOverride?: Pair[]) {
    const activePool = poolOverride ?? pool;
    const dealt = drawRound(activePool);
    setPairs(dealt);
    pairsRef.current = dealt;
    dealRoundTiles(dealt);

    setSelectedKey(null);
    setWrongKeys([]);
    setMatchedCardIds([]);
    setMissedCardIds([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setNewBest(false);
    setTimeLeft(ROUND_SECONDS);
    setRoundIndex(0);
    setSessionMatched(0);
    setSessionMissed(0);
    setSessionTotal(0);

    timeLeftRef.current = ROUND_SECONDS;
    scoreRef.current = 0;
    matchedRef.current = [];
    missedRef.current = [];
    lockRef.current = false;
    finishedRef.current = false;
    roundIndexRef.current = 0;
    sessionResultsRef.current = new Map();
    sessionMatchedRef.current = 0;
    sessionMissedRef.current = 0;
    sessionTotalRef.current = 0;
    setPhase("playing");
  }

  function shakeTiles(keys: string[]) {
    const animations = keys.map((key) =>
      Animated.sequence([
        Animated.timing(getShake(key), { toValue: 1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(getShake(key), { toValue: -1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(getShake(key), { toValue: 1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(getShake(key), { toValue: 0, duration: 55, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    Animated.parallel(animations).start();
  }

  function onTilePress(tile: Tile) {
    if (phase !== "playing" || lockRef.current) return;
    if (matchedCardIds.includes(tile.cardId)) return;

    if (!selectedKey) {
      setSelectedKey(tile.key);
      return;
    }

    if (selectedKey === tile.key) {
      setSelectedKey(null);
      return;
    }

    const selectedTile = [...promptTiles, ...answerTiles].find((t) => t.key === selectedKey);
    if (!selectedTile) {
      setSelectedKey(tile.key);
      return;
    }

    // Tapping another tile on the same side just moves the selection.
    if (selectedTile.side === tile.side) {
      setSelectedKey(tile.key);
      return;
    }

    if (selectedTile.cardId === tile.cardId) {
      onCorrectMatch(tile.cardId);
    } else {
      onWrongMatch([selectedTile.key, tile.key]);
    }
  }

  function onCorrectMatch(cardId: string) {
    const nextCombo = combo + 1;
    const gained = BASE_POINTS + COMBO_STEP * (nextCombo - 1);
    const nextMatched = [...matchedRef.current, cardId];

    matchedRef.current = nextMatched;
    scoreRef.current += gained;

    setCombo(nextCombo);
    setBestCombo((b) => Math.max(b, nextCombo));
    setScore(scoreRef.current);
    setMatchedCardIds(nextMatched);
    setSelectedKey(null);

    if (nextMatched.length === pairsRef.current.length) {
      finishRound("cleared");
    }
  }

  function onWrongMatch(keys: string[]) {
    lockRef.current = true;
    scoreRef.current = Math.max(0, scoreRef.current - WRONG_POINTS);
    timeLeftRef.current = Math.max(0, timeLeftRef.current - WRONG_TIME_PENALTY);

    setWrongKeys(keys);
    setCombo(0);
    setScore(scoreRef.current);
    setTimeLeft(timeLeftRef.current);

    // Both cards involved in the mistake count as "struggled".
    const involved = keys.map((k) => k.slice(2));
    missedRef.current = [...new Set([...missedRef.current, ...involved])];
    setMissedCardIds(missedRef.current);

    shakeTiles(keys);
    setTimeout(() => {
      setWrongKeys([]);
      setSelectedKey(null);
      lockRef.current = false;
    }, 420);
  }

  /** Ends the current round, records its outcome, then either deals the next
   * round in the set (back to back) or wraps up the whole set. */
  function finishRound(reason: "cleared" | "timeout") {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (reason === "cleared" && timeLeftRef.current > 0) {
      scoreRef.current += Math.round(timeLeftRef.current) * TIME_BONUS_PER_SECOND;
      setScore(scoreRef.current);
    }

    const struggled = new Set(missedRef.current);
    for (const pair of pairsRef.current) {
      const cleared = matchedRef.current.includes(pair.cardId);
      const rating: 1 | 4 = cleared && !struggled.has(pair.cardId) ? 4 : 1;
      sessionResultsRef.current.set(pair.cardId, rating);
    }
    sessionMatchedRef.current += matchedRef.current.length;
    sessionMissedRef.current += missedRef.current.length;
    sessionTotalRef.current += pairsRef.current.length;
    setSessionMatched(sessionMatchedRef.current);
    setSessionMissed(sessionMissedRef.current);
    setSessionTotal(sessionTotalRef.current);

    const isLastRound = roundIndexRef.current >= ROUNDS_PER_SET - 1;
    if (!isLastRound) {
      // Brief pause so the player sees the last match/timeout land, then the
      // next round of the set deals itself — no trip back to a menu.
      setTimeout(() => {
        roundIndexRef.current += 1;
        setRoundIndex(roundIndexRef.current);

        const dealt = drawRound(pool);
        pairsRef.current = dealt;
        setPairs(dealt);
        dealRoundTiles(dealt);

        setSelectedKey(null);
        setWrongKeys([]);
        setMatchedCardIds([]);
        setMissedCardIds([]);
        matchedRef.current = [];
        missedRef.current = [];
        setTimeLeft(ROUND_SECONDS);
        timeLeftRef.current = ROUND_SECONDS;
        lockRef.current = false;
        finishedRef.current = false;
      }, NEXT_ROUND_DELAY);
      return;
    }

    finishSet();
  }

  function finishSet() {
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

    submitRatings(sessionResultsRef.current);
    setPhase("results");
  }

  async function submitRatings(results: Map<string, 1 | 4>) {
    const submissions = [...results.entries()].map(([cardId, rating]) =>
      api.review.submit(cardId, rating).catch(() => {}),
    );
    await Promise.all(submissions);
  }

  const timeFraction = timeLeft / ROUND_SECONDS;
  const timeLow = timeLeft <= 10;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <Shell>
        <View style={styles.center}>
          <ActivityIndicator color="#111111" />
          <Text style={styles.loadingText}>Shuffling the deck…</Text>
        </View>
      </Shell>
    );
  }

  // ── Not enough cards ─────────────────────────────────────────────────────
  if (phase === "empty") {
    return (
      <Shell>
        <View style={styles.center}>
          <Text style={styles.bigEmoji}>🎮</Text>
          <Text style={styles.emptyTitle}>Not enough cards yet</Text>
          <Text style={styles.emptyBody}>
            Term Match needs at least two questions from this topic. Add a lecture or run a quiz first.
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
          <Text style={styles.headerTitle}>Term Match</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigEmoji}>🎮</Text>
          <Text style={styles.introTitle}>Term Match</Text>
          <Text style={styles.introSub}>
            {ROUND_SECONDS} seconds a round, {ROUNDS_PER_SET} rounds of {PAIRS_PER_ROUND} pairs, back to back. Tap a
            prompt, then its answer.
          </Text>

          <View style={styles.rulesCard}>
            <Rule emoji="⚡" text={`Every match scores ${BASE_POINTS} — chain them for a combo bonus.`} />
            <Rule emoji="💥" text={`A wrong pair costs ${WRONG_POINTS} points and ${WRONG_TIME_PENALTY} seconds.`} />
            <Rule emoji="🏁" text={`Clear a round early and every second left is worth ${TIME_BONUS_PER_SECOND}.`} />
            <Rule emoji="🧠" text="Pairs you nail first try get scheduled further out for review." />
          </View>

          {bestScore !== null && bestScore > 0 && (
            <Text style={styles.bestLine}>Your best on this topic: {bestScore.toLocaleString()}</Text>
          )}

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              AsyncStorage.setItem(INTRO_SEEN_KEY, "1").catch(() => {});
              startSet();
            }}
          >
            <Text style={styles.primaryBtnText}>Start round</Text>
          </Pressable>
        </ScrollView>
      </Shell>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (phase === "results") {
    const cleared = sessionMatched;
    const total = sessionTotal;
    const perfect = cleared === total && sessionMissed === 0 && total > 0;

    return (
      <Shell>
        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.bigEmoji}>{perfect ? "🌟" : cleared === total ? "🎉" : "⏱️"}</Text>
          <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>
            {perfect ? "Flawless set!" : cleared === total ? "Set cleared!" : "Set complete"}
          </Text>

          {newBest && (
            <View style={styles.newBestBanner}>
              <Text style={styles.newBestText}>🏆  New best score on this topic!</Text>
            </View>
          )}

          <View style={styles.statRow}>
            <StatBox label="Matched" value={`${cleared}/${total}`} />
            <StatBox label="Best combo" value={`×${bestCombo}`} />
            <StatBox label="Slips" value={String(sessionMissed)} />
          </View>

          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>
              {sessionMissed > 0
                ? `🔁  ${sessionMissed} pair${sessionMissed !== 1 ? "s" : ""} saved for review — we'll bring them back sooner.`
                : "✅  All pairs reinforced — great recall!"}
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={() => startSet()}>
            <Text style={styles.primaryBtnText}>Play again</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Back to studying</Text>
          </Pressable>
        </ScrollView>
      </Shell>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  return (
    <Shell>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <Text style={styles.headerScore}>{score.toLocaleString()}</Text>
        <Text style={[styles.headerTimer, timeLow && styles.headerTimerLow]}>{Math.ceil(timeLeft)}s</Text>
      </View>

      <View style={styles.timerTrack}>
        <View
          style={[
            styles.timerFill,
            { width: `${Math.max(0, timeFraction) * 100}%` },
            timeLow && styles.timerFillLow,
          ]}
        />
      </View>

      <View style={styles.comboRow}>
        <Text style={styles.roundText}>Round {roundIndex + 1} of {ROUNDS_PER_SET}</Text>
        <Text style={styles.comboText}>
          {combo >= 2 ? `🔥 ${combo} in a row  ·  +${COMBO_STEP * combo} next` : "Tap a prompt, then its answer"}
        </Text>
      </View>

      <View style={styles.board}>
        <Column
          tiles={promptTiles}
          selectedKey={selectedKey}
          wrongKeys={wrongKeys}
          matchedCardIds={matchedCardIds}
          onPress={onTilePress}
          getShake={getShake}
        />
        <Column
          tiles={answerTiles}
          selectedKey={selectedKey}
          wrongKeys={wrongKeys}
          matchedCardIds={matchedCardIds}
          onPress={onTilePress}
          getShake={getShake}
          accent
        />
      </View>
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

function Column({
  tiles,
  selectedKey,
  wrongKeys,
  matchedCardIds,
  onPress,
  getShake,
  accent,
}: {
  tiles: Tile[];
  selectedKey: string | null;
  wrongKeys: string[];
  matchedCardIds: string[];
  onPress: (tile: Tile) => void;
  getShake: (key: string) => Animated.Value;
  accent?: boolean;
}) {
  return (
    <View style={styles.column}>
      {tiles.map((tile) => {
        const state: TileState = matchedCardIds.includes(tile.cardId)
          ? "matched"
          : wrongKeys.includes(tile.key)
            ? "wrong"
            : selectedKey === tile.key
              ? "selected"
              : "idle";
        return (
          <TileView
            key={tile.key}
            tile={tile}
            state={state}
            accent={accent}
            shake={getShake(tile.key)}
            onPress={() => onPress(tile)}
          />
        );
      })}
    </View>
  );
}

function TileView({
  tile,
  state,
  accent,
  shake,
  onPress,
}: {
  tile: Tile;
  state: TileState;
  accent?: boolean;
  shake: Animated.Value;
  onPress: () => void;
}) {
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });

  const tileStyle = [
    styles.tile,
    accent ? styles.tileAccent : styles.tilePrompt,
    state === "selected" && styles.tileSelected,
    state === "wrong" && styles.tileWrong,
    state === "matched" && styles.tileMatched,
  ];

  const textStyle = [
    styles.tileText,
    state === "selected" && styles.tileTextSelected,
    state === "wrong" && styles.tileTextWrong,
    state === "matched" && styles.tileTextMatched,
  ];

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
      <Pressable style={tileStyle} onPress={onPress} disabled={state === "matched"}>
        <Text style={textStyle} numberOfLines={4}>
          {state === "matched" ? "✓" : tile.text}
        </Text>
      </Pressable>
    </Animated.View>
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
  backBtn: { padding: 4, minWidth: 44 },
  backText: { fontFamily: "Figtree_600SemiBold", fontSize: 18, color: "#78716C" },
  headerTitle: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#111111" },
  headerScore: { fontFamily: "Figtree_700Bold", fontSize: 22, color: "#111111", letterSpacing: -0.5 },
  headerTimer: {
    fontFamily: "Figtree_700Bold",
    fontSize: 16,
    color: "#78716C",
    minWidth: 44,
    textAlign: "right",
  },
  headerTimerLow: { color: "#dc3545" },

  timerTrack: {
    height: 5,
    backgroundColor: "#F5F4F0",
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: { height: 5, backgroundColor: "#111111", borderRadius: 3 },
  timerFillLow: { backgroundColor: "#dc3545" },

  comboRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignItems: "center", gap: 2 },
  roundText: { fontFamily: "Figtree_500Medium", fontSize: 11, color: "#a8a29e", letterSpacing: 0.5 },
  comboText: { fontFamily: "Figtree_500Medium", fontSize: 13, color: "#78716C" },

  board: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  column: { flex: 1, gap: 10 },

  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tilePrompt: { backgroundColor: "#F5F4F0", borderColor: "#E5E1D8" },
  tileAccent: { backgroundColor: "#F3F1FB", borderColor: "#E0DAF5" },
  tileSelected: { backgroundColor: "#E8E4F8", borderColor: "#7C3AED" },
  tileWrong: { backgroundColor: "#f5c6cc", borderColor: "#dc3545" },
  tileMatched: { backgroundColor: "#cbe1c3", borderColor: "#a3d08f" },

  tileText: {
    fontFamily: "Figtree_500Medium",
    fontSize: 12,
    lineHeight: 17,
    color: "#111111",
    textAlign: "center",
  },
  tileTextSelected: { color: "#4d3aa3", fontFamily: "Figtree_600SemiBold" },
  tileTextWrong: { color: "#420000" },
  tileTextMatched: { color: "#519336", fontSize: 20, lineHeight: 24 },

  introScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 12,
  },
  bigEmoji: { fontSize: 64 },
  introTitle: {
    fontFamily: "Figtree_700Bold",
    fontSize: 30,
    color: "#111111",
    letterSpacing: -0.8,
  },
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
  primaryBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 16, color: "#FFFFFF" },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryBtnText: { fontFamily: "Figtree_600SemiBold", fontSize: 15, color: "#78716C" },
});
