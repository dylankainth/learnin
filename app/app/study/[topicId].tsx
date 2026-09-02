import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
} from "react-native";
import { StatusBar, setStatusBarBackgroundColor, setStatusBarStyle } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
let VolumeManager: typeof import("react-native-volume-manager").VolumeManager | null = null;
try {
  VolumeManager = require("react-native-volume-manager").VolumeManager;
} catch {
  // not linked — volume scrolling unavailable (e.g. Expo Go)
}
import * as NavigationBar from "expo-navigation-bar";
import { colors } from "@/theme/colors";
import { typography, fonts } from "@/theme/typography";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import { InlineQuiz } from "@/components/InlineQuiz";
import { api } from "@/lib/api";
import { useOnReconnect } from "@/lib/connectivity";
import type { TopicBlock, TopicStudyDetail } from "@/lib/types";

// Sectional rendering tuning: small enough that the first paint is cheap,
// large enough that a normal-size phone screen doesn't show blank space
// before the next batch lands.
const INITIAL_BLOCK_BATCH = 4;
const BLOCK_BATCH_SIZE = 3;
const BLOCK_BATCH_DELAY_MS = 150;
// Used only as a rough restore estimate when a target block's own height
// isn't measurable yet (its own layout is in, but the next block's isn't) —
// close enough to land in the right block; the next real layout pass
// corrects it once it's available.
const FALLBACK_BLOCK_HEIGHT = 420;
// Scroll-restore watchdog: re-scroll to the saved spot every tick until the
// layout above it has been still for QUIET ms, giving late-resizing content
// (mermaid WebViews, images) time to push the target into its final place.
const RESTORE_TICK_MS = 120;
const LAYOUT_QUIET_MS = 450;
const RESTORE_MAX_MS = 6000;

type BlockPosition = { blockId: string; fraction: number };

// Last scroll position we wrote for a topic this app session, kept in memory so
// a quick leave-and-return doesn't lose it: the save PATCH and the next load's
// GET race with no ordering guarantee, and the GET can win and hand back the
// pre-session value. Preferred over the server value only when it's newer
// (compared against the server's lastScrollAt), so another device still wins.
const recentScrollByTopic = new Map<string, { blockId: string; fraction: number; at: number }>();

type TocEntry = { text: string; level: number; blockIndex: number };

function extractHeadings(markdown: string): { level: number; text: string }[] {
  const result: { level: number; text: string }[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) result.push({ level: m[1].length, text: m[2].trim() });
  }
  return result;
}

function buildToc(blocks: TopicBlock[]): TocEntry[] {
  const entries: TocEntry[] = [];
  blocks.forEach((block, i) => {
    if (block.type === "explainer" && block.markdown) {
      for (const h of extractHeadings(block.markdown)) {
        entries.push({ ...h, blockIndex: i });
      }
    }
  });
  return entries;
}

export default function TopicStudyScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const [detail, setDetail] = useState<TopicStudyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentsVisible, setContentsVisible] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [progressStats, setProgressStats] = useState({ total: 0, read: 0 });
  const blockStatsRef = useRef<Map<string, { total: number; read: number }>>(new Map());
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const blockOffsets = useRef<number[]>([]);
  const detailRef = useRef<TopicStudyDetail | null>(null);
  const progressReadRef = useRef(0);
  const scrollY = useRef(0);
  const lastVolume = useRef<number | null>(null);
  const SCROLL_STEP = Dimensions.get("window").height * 0.8;
  const savedBlockPosition = useRef<BlockPosition | null>(null);
  const hasRestoredScroll = useRef(false);
  const restoreAppliedRef = useRef(false);
  const lastLayoutChangeAt = useRef(0);
  const restoreWatchdog = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedKey = useRef<string | null>(null);

  // Sectional rendering: only the first few blocks mount immediately (fast
  // first paint on a fresh document), then the rest mount in small batches
  // in the background. When there's a saved scroll position to restore,
  // mounting instead jumps straight through the target block (see `load`)
  // — restore is block-based, so it never needs the rest of the document.
  const [mountedCount, setMountedCount] = useState(0);
  const mountedCountRef = useRef(0);
  function updateMountedCount(next: number) {
    mountedCountRef.current = next;
    setMountedCount(next);
  }

  /** Which block `scrollY.current` currently sits in, and how far through it (0-1). Null if nothing measured yet. */
  function currentBlockPosition(): BlockPosition | null {
    const blocks = detailRef.current?.blocks;
    if (!blocks) return null;
    const offsets = blockOffsets.current;

    let idx = -1;
    for (let i = 0; i < mountedCountRef.current; i++) {
      if (offsets[i] === undefined) break; // offsets fill in top-to-bottom order — a gap means "not measured yet"
      if (offsets[i] <= scrollY.current) idx = i;
      else break;
    }
    if (idx === -1) idx = 0;
    if (offsets[idx] === undefined) return null;

    const start = offsets[idx];
    const end = offsets[idx + 1] ?? (idx === blocks.length - 1 ? contentHeight.current : start + FALLBACK_BLOCK_HEIGHT);
    const blockHeight = Math.max(1, end - start);
    const fraction = Math.min(1, Math.max(0, (scrollY.current - start) / blockHeight));
    return { blockId: blocks[idx].id, fraction };
  }

  /** Pixel y that `savedBlockPosition` maps to given the offsets measured so far. Null if not enough is measured yet. */
  function computeRestoreY(): number | null {
    const target = savedBlockPosition.current;
    const blocks = detailRef.current?.blocks;
    if (!target || !blocks) return null;
    const targetIndex = blocks.findIndex((b) => b.id === target.blockId);
    if (targetIndex === -1) return null;

    const offsets = blockOffsets.current;
    const start = offsets[targetIndex];
    if (start === undefined) return null; // target block hasn't laid out yet

    const isLastBlock = targetIndex === blocks.length - 1;
    let end = offsets[targetIndex + 1];
    if (end === undefined) {
      end = isLastBlock && contentHeight.current > start ? contentHeight.current : start + FALLBACK_BLOCK_HEIGHT;
    }
    return start + target.fraction * Math.max(1, end - start);
  }

  function finishRestore() {
    hasRestoredScroll.current = true;
    if (restoreWatchdog.current) {
      clearInterval(restoreWatchdog.current);
      restoreWatchdog.current = null;
    }
  }

  /** Record a block's measured top; flag that layout moved so the restore watchdog keeps correcting. */
  function noteBlockOffset(index: number, y: number) {
    if (blockOffsets.current[index] !== y) {
      blockOffsets.current[index] = y;
      // Only layout at/above the target (plus its next sibling, which fixes the
      // target's height) changes where we need to land. Blocks further down
      // keep shifting as sectional rendering mounts the rest of the document —
      // ignore those, or the watchdog would never see the layout go "quiet".
      const target = savedBlockPosition.current;
      const blocks = detailRef.current?.blocks;
      if (target && blocks && !hasRestoredScroll.current) {
        const ti = blocks.findIndex((b) => b.id === target.blockId);
        if (ti !== -1 && index <= ti + 1) lastLayoutChangeAt.current = Date.now();
      }
    }
    tryRestoreScroll();
  }

  // Restore isn't one-shot: the target block's true height isn't known until
  // the *next* block has also laid out, and a diagram/image above it can keep
  // growing for a second or more after first paint (mermaid renders in a
  // WebView and reports its height back late), shifting the target down. So we
  // re-scroll on every layout change and keep a watchdog running (see `load`)
  // that only calls `finishRestore` once layout has been quiet for a beat — or
  // the user starts scrolling, or a hard timeout hits.
  function tryRestoreScroll() {
    if (hasRestoredScroll.current) return;
    const target = savedBlockPosition.current;
    const blocks = detailRef.current?.blocks;
    if (!target || !blocks || blocks.findIndex((b) => b.id === target.blockId) === -1) {
      // Nothing to restore to (fresh open, or the saved block was regenerated away).
      finishRestore();
      return;
    }
    const y = computeRestoreY();
    if (y === null) return; // not measured enough yet — a later layout event retries
    restoreAppliedRef.current = true;
    requestAnimationFrame(() => {
      if (!hasRestoredScroll.current) scrollRef.current?.scrollTo({ y, animated: false });
    });
  }

  // Keeps nudging the scroll position to the saved spot until the layout above
  // it settles (quiet for LAYOUT_QUIET_MS), then locks it in. Hard-capped so it
  // always ends even if something above never stops resizing.
  function startRestoreWatchdog() {
    if (restoreWatchdog.current) clearInterval(restoreWatchdog.current);
    restoreAppliedRef.current = false;
    lastLayoutChangeAt.current = Date.now();
    const startedAt = Date.now();
    restoreWatchdog.current = setInterval(() => {
      if (hasRestoredScroll.current) {
        finishRestore();
        return;
      }
      tryRestoreScroll();
      const quiet = Date.now() - lastLayoutChangeAt.current > LAYOUT_QUIET_MS;
      if ((restoreAppliedRef.current && quiet) || Date.now() - startedAt > RESTORE_MAX_MS) {
        finishRestore();
      }
    }, RESTORE_TICK_MS);
  }

  function persistScrollPosition(pos: BlockPosition) {
    if (!topicId) return;
    const key = `${pos.blockId}:${Math.round(pos.fraction * 100)}`;
    if (key === lastSavedKey.current) return;
    lastSavedKey.current = key;
    recentScrollByTopic.set(topicId, { blockId: pos.blockId, fraction: pos.fraction, at: Date.now() });
    api.topics.saveScroll(topicId, pos.blockId, pos.fraction).catch(() => {});
  }

  function scheduleScrollSave() {
    if (!topicId || !hasRestoredScroll.current) return; // don't save until initial restore has settled
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      const pos = currentBlockPosition();
      if (pos) persistScrollPosition(pos);
    }, 1000);
  }

  // Grows the mounted prefix in small background batches until every block
  // is mounted. No-ops once caught up (e.g. after a restore-triggered jump
  // straight to full mount), and self-cancels on unmount/topic change.
  useEffect(() => {
    if (!detail) return;
    if (mountedCount >= detail.blocks.length) return;
    const id = setTimeout(() => {
      updateMountedCount(Math.min(detail.blocks.length, mountedCountRef.current + BLOCK_BATCH_SIZE));
    }, BLOCK_BATCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [detail, mountedCount]);

  const onBlockStatsChange = useCallback((blockId: string, total: number, read: number) => {
    const prev = blockStatsRef.current.get(blockId);
    if (prev?.total === total && prev?.read === read) return;
    blockStatsRef.current.set(blockId, { total, read });
    let t = 0, r = 0;
    for (const s of blockStatsRef.current.values()) { t += s.total; r += s.read; }
    progressReadRef.current = r;
    setProgressStats({ total: t, read: r });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!topicId) return;
    if (!silent) setLoading(true);
    try {
      const isFirstLoadForThisScreen = detailRef.current === null;
      const data = await api.topics.study(topicId);
      detailRef.current = data;
      setDetail(data);
      if (!silent) {
        // Prefer the position we wrote this session over the server's if ours
        // is newer — the save PATCH and this GET race with no ordering guarantee.
        const serverAt = data.topic.lastScrollAt ? new Date(data.topic.lastScrollAt).getTime() : 0;
        const recent = recentScrollByTopic.get(topicId);
        savedBlockPosition.current =
          recent && recent.at > serverAt
            ? { blockId: recent.blockId, fraction: recent.fraction }
            : data.topic.lastScrollBlockId
              ? { blockId: data.topic.lastScrollBlockId, fraction: data.topic.lastScrollFraction ?? 0 }
              : null;
        const savedBlockId = savedBlockPosition.current?.blockId ?? null;

        hasRestoredScroll.current = savedBlockPosition.current === null;
        // The watchdog re-scrolls on its own ticks (covering the case where the
        // screen was already mounted and no layout event fires) as well as on
        // every layout change, until the content above the target settles.
        if (savedBlockPosition.current) startRestoreWatchdog();
        requestAnimationFrame(() => tryRestoreScroll());

        // Block-based restore only needs the target block (plus one more,
        // for an accurate in-block offset) mounted — never the whole
        // document just to restore to a position, unlike pixel-percent
        // restore which needed the true total height. Never shrinks
        // whatever's already mounted; also covers a refocus revealing a
        // newly-saved position (e.g. synced from another device) mid-batch.
        const targetIndex = savedBlockId ? data.blocks.findIndex((b) => b.id === savedBlockId) : -1;
        if (targetIndex >= 0 && mountedCountRef.current < targetIndex + 2) {
          updateMountedCount(Math.min(data.blocks.length, targetIndex + 2));
        } else if (isFirstLoadForThisScreen) {
          updateMountedCount(Math.min(data.blocks.length, INITIAL_BLOCK_BATCH));
        }
      }
      if (data.processingCount > 0) {
        pollRef.current = setTimeout(() => load(true), 5000);
      }
    } catch (err) {
      console.error("Failed to load study content:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [topicId]);

  useFocusEffect(
    useCallback(() => {
      NavigationBar.setBackgroundColorAsync(colors.surface);
      NavigationBar.setButtonStyleAsync("dark");
      setStatusBarBackgroundColor("transparent", false);
      setStatusBarStyle("dark");
      return () => {
        NavigationBar.setBackgroundColorAsync(colors.bg);
        NavigationBar.setButtonStyleAsync("dark");
        setStatusBarBackgroundColor(colors.bg, false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      load();
      VolumeManager?.showNativeVolumeUI({ enabled: false });
      VolumeManager?.getVolume().then((v) => { lastVolume.current = v.volume; });
      const sub = VolumeManager?.addVolumeListener((result) => {
        const prev = lastVolume.current;
        lastVolume.current = result.volume;
        if (prev === null) return;
        if (!hasRestoredScroll.current) finishRestore(); // user is driving now — stop auto-correcting
        if (result.volume > prev) {
          scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - SCROLL_STEP), animated: true });
        } else if (result.volume < prev) {
          scrollRef.current?.scrollTo({ y: scrollY.current + SCROLL_STEP, animated: true });
        }
      });
      return () => {
        if (pollRef.current) clearTimeout(pollRef.current);
        if (restoreWatchdog.current) clearInterval(restoreWatchdog.current);
        sub?.remove();
        VolumeManager?.showNativeVolumeUI({ enabled: true });
      };
    }, [load, SCROLL_STEP]),
  );

  // Came back online after being offline — silently pull the latest content
  // (a global toast already told the user this is happening).
  useOnReconnect(useCallback(() => { load(true); }, [load]));

  useFocusEffect(
    useCallback(() => {
      const sessionStart = Date.now();
      const initialRead = progressReadRef.current;

      return () => {
        if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
        // Block position only ever needs blocks up to the current scroll
        // offset — which are always already mounted, since you can't scroll
        // past content that isn't rendered — so unlike the old pixel-percent
        // save, this doesn't need to wait for sectional rendering to finish
        // mounting the rest of the document.
        if (hasRestoredScroll.current && topicId) {
          const pos = currentBlockPosition();
          if (pos) persistScrollPosition(pos);
        }

        const durationMin = (Date.now() - sessionStart) / 60000;
        const newlyRead = progressReadRef.current - initialRead;
        if (durationMin < 1 || newlyRead < 2) return;

        const blocks = detailRef.current?.blocks ?? [];
        const allMarkdown = blocks
          .filter((b) => b.type === "explainer" && b.markdown)
          .map((b) => b.markdown!)
          .join(" ");
        const totalWords = allMarkdown.split(/\s+/).filter(Boolean).length;
        const totalParagraphs = [...blockStatsRef.current.values()].reduce((s, v) => s + v.total, 0);
        const avgWords = totalParagraphs > 0 ? totalWords / totalParagraphs : 55;
        const wpm = Math.round((newlyRead * avgWords) / durationMin);

        if (wpm < 50 || wpm > 1500) return;

        const date = new Date().toISOString().split("T")[0];
        AsyncStorage.getItem("@learnin/reading_sessions").then((raw) => {
          const sessions: { date: string; wpm: number }[] = raw ? JSON.parse(raw) : [];
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const pruned = sessions.filter((s) => new Date(s.date).getTime() >= cutoff);
          pruned.push({ date, wpm });
          AsyncStorage.setItem("@learnin/reading_sessions", JSON.stringify(pruned));
        });
      };
    }, []),
  );

  async function onLockBlock(blockId: string) {
    try {
      await api.blocks.lock(blockId);
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, locked: true } : b)),
        };
      });
    } catch {
      // not critical
    }
  }

  function scrollToBlock(blockIndex: number) {
    setContentsVisible(false);
    if (!hasRestoredScroll.current) finishRestore(); // explicit jump wins over an in-progress restore

    // The target block might not be mounted yet under sectional rendering —
    // force it (and everything before it) to mount before reading its
    // offset, or this would silently fall back to y=0 and jump to the top.
    const needsMount = mountedCountRef.current <= blockIndex;
    if (needsMount && detail) {
      updateMountedCount(Math.min(detail.blocks.length, blockIndex + 1));
    }

    setTimeout(
      () => {
        const y = blockOffsets.current[blockIndex] ?? 0;
        scrollRef.current?.scrollTo({ y, animated: true });
      },
      needsMount ? 180 : 50, // give the newly-mounted blocks a moment to lay out first
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || detail.blocks.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="Study" onTitlePress={undefined} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
          {detail?.processingCount ? (
            <>
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={[typography.h2, { textAlign: "center" }]}>Building your study material…</Text>
              <Text style={[typography.body, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
                {detail.processingCount} lecture{detail.processingCount !== 1 ? "s" : ""} still processing.
              </Text>
            </>
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}>
              No content yet. Add a PDF or video from the topic page.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const toc = buildToc(detail.blocks);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <Header
        title={detail.topic.name}
        onTitlePress={toc.length > 0 ? () => setContentsVisible(true) : undefined}
      />

      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          scrollY.current = y;
          const scrollable = contentHeight.current - viewportHeight.current;
          const percent = scrollable > 0 ? Math.min(100, Math.max(0, Math.round((y / scrollable) * 100))) : 0;
          setScrollPercent(percent);
          scheduleScrollSave();
        }}
        onScrollBeginDrag={() => { if (!hasRestoredScroll.current) finishRestore(); }}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => {
          // A growing content height is mostly sectional rendering appending
          // blocks below — only relevant to restore when the target is the last
          // block (computeRestoreY falls back to contentHeight for its end).
          const blocks = detailRef.current?.blocks;
          const target = savedBlockPosition.current;
          if (
            contentHeight.current !== h && target && blocks &&
            blocks.findIndex((b) => b.id === target.blockId) === blocks.length - 1
          ) {
            lastLayoutChangeAt.current = Date.now();
          }
          contentHeight.current = h;
          tryRestoreScroll();
        }}
        onLayout={(e) => { viewportHeight.current = e.nativeEvent.layout.height; tryRestoreScroll(); }}
      >
        {detail.blocks.slice(0, mountedCount).map((block, index) =>
          block.type === "explainer" ? (
            <View
              key={block.id}
              onLayout={(e) => noteBlockOffset(index, e.nativeEvent.layout.y)}
            >
              <ExplainerItem
                block={block}
                onLock={() => onLockBlock(block.id)}
                onStatsChange={onBlockStatsChange}
              />
            </View>
          ) : (
            <View
              key={block.id}
              onLayout={(e) => noteBlockOffset(index, e.nativeEvent.layout.y)}
            >
              <QuestSection topicId={topicId!} documentId={block.documentId} />
            </View>
          ),
        )}

        {detail.processingCount > 0 && (
          <View style={styles.processingFooter}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 8 }]}>
              {detail.processingCount} more lecture{detail.processingCount !== 1 ? "s" : ""} processing…
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <View style={styles.progressBar}>
        <Text style={styles.progressText}>{scrollPercent}%</Text>
        <Text style={styles.progressText}>
          {progressStats.read}/{progressStats.total}
        </Text>
      </View>

      {toc.length > 0 && (
        <ContentsModal
          visible={contentsVisible}
          entries={toc}
          onClose={() => setContentsVisible(false)}
          onSelect={scrollToBlock}
        />
      )}
    </SafeAreaView>
  );
}

function ContentsModal({
  visible,
  entries,
  onClose,
  onSelect,
}: {
  visible: boolean;
  entries: TocEntry[];
  onClose: () => void;
  onSelect: (blockIndex: number) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.tocBackdrop} onPress={onClose}>
        <Pressable style={styles.tocPanel} onPress={() => {}}>
          <Text style={styles.tocTitle}>Contents</Text>
          <FlatList
            data={entries}
            keyExtractor={(_, i) => String(i)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.tocEntry, pressed && styles.tocEntryPressed]}
                onPress={() => onSelect(item.blockIndex)}
              >
                <Text
                  style={[
                    styles.tocEntryText,
                    item.level === 1 && styles.tocH1,
                    item.level === 2 && styles.tocH2,
                    item.level === 3 && styles.tocH3,
                  ]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExplainerItem({
  block,
  onLock,
  onStatsChange,
}: {
  block: TopicBlock;
  onLock: () => void;
  onStatsChange?: (blockId: string, total: number, read: number) => void;
}) {
  return (
    <View style={styles.section}>
      <InlineMarkdown
        text={block.markdown ?? ""}
        blockId={block.id}
        readParagraphs={block.readParagraphs ?? []}
        onStatsChange={(total, read) => onStatsChange?.(block.id, total, read)}
      />
    </View>
  );
}

function QuizItem({ block }: { block: TopicBlock }) {
  const quizBlock = {
    id: block.id,
    type: "quiz" as const,
    question: block.question ?? "",
    options: block.options ?? null,
    answer: block.answer ?? "",
    explanation: block.explanation ?? "",
    cardId: block.cardId,
    dueAt: block.dueAt,
    reps: block.reps,
  };
  return (
    <View style={styles.quizWrap}>
      <View style={styles.quizRule} />
      <Text style={styles.quizLabel}>Check your understanding</Text>
      <InlineQuiz block={quizBlock} />
      <View style={styles.quizRule} />
    </View>
  );
}

type Quest = {
  id: string; label: string; emoji: string; locked: boolean;
  bg: string; fg: string; onPress?: () => void;
};

function QuestSection({ topicId, documentId }: { topicId: string; documentId?: string }) {
  const quests: Quest[] = [
    { id: "quiz", label: "Quiz", emoji: "🧠", locked: false, bg: "#cbc4e1", fg: "#1f2184",
      onPress: () => router.push({ pathname: "/quiz/[topicId]", params: { topicId, documentId: documentId ?? "" } }) },
    { id: "longform", label: "Long Answer", emoji: "✍️", locked: false, bg: "#cbe1c3", fg: "#255312",
      onPress: () => router.push({ pathname: "/longform/[topicId]", params: { topicId, documentId: documentId ?? "" } }) },
    { id: "minigame", label: "Term Match", emoji: "🎮", locked: false, bg: "#ce9eaa", fg: "#420000",
      onPress: () => router.push({ pathname: "/minigame/[topicId]", params: { topicId, documentId: documentId ?? "" } }) },
    { id: "recall", label: "Recall Rush", emoji: "⚡", locked: false, bg: "#e1d7bb", fg: "#4a3a00",
      onPress: () => router.push({ pathname: "/recall-rush/[topicId]", params: { topicId, documentId: documentId ?? "" } }) },
  ];

  return (
    <View style={styles.questSection}>
      <View style={styles.questRule} />
      <Text style={styles.questLabel}>Check your understanding</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questRow}>
        {quests.map((q) => (
          <Pressable
            key={q.id}
            style={[styles.questCard, { backgroundColor: q.bg }, q.locked && styles.questCardLocked]}
            onPress={q.locked ? undefined : q.onPress}
            disabled={q.locked}
          >
            <Text style={styles.questEmoji}>{q.emoji}</Text>
            <Text style={[styles.questName, { color: q.fg }]}>{q.label}</Text>
            {q.locked && <Text style={styles.questLock}>🔒</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Header({
  title,
  onTitlePress,
}: {
  title: string;
  onTitlePress?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        style={{ flex: 1, alignItems: "center" }}
        onPress={onTitlePress}
        disabled={!onTitlePress}
      >
        <Text
          style={[
            typography.caption,
            { textAlign: "center", color: colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  page: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  section: {
    marginBottom: 8,
  },
  quizWrap: {
    marginVertical: 8,
  },
  quizRule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  quizLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  progressText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    opacity: 0.7,
  },
  processingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  questSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  questRule: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  questLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  questRow: {
    gap: 12,
    paddingRight: 4,
  },
  questCard: {
    width: 100,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  questCardLocked: {
    opacity: 0.6,
  },
  questEmoji: {
    fontSize: 28,
  },
  questName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: "center",
  },
  questLock: {
    fontSize: 11,
  },
  tocBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
  },
  tocPanel: {
    backgroundColor: colors.bg,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    maxHeight: "65%",
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  tocTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: "uppercase",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tocEntry: {
    paddingVertical: 11,
    paddingHorizontal: 24,
  },
  tocEntryPressed: {
    backgroundColor: colors.border,
  },
  tocEntryText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  tocH1: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  tocH2: {
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingLeft: 12,
  },
  tocH3: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    paddingLeft: 24,
  },
});
