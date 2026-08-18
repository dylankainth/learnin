import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, accentFor } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "./BlobMascot";

interface DeckCardProps {
  id: string;
  title: string;
  dueCount: number;
  cardCount: number;
  status: "pending" | "processing" | "ready" | "error";
  onPress: () => void;
}

const STATUS_LABEL: Record<DeckCardProps["status"], string> = {
  pending: "Queued",
  processing: "Building your quizzes…",
  ready: "",
  error: "Something went wrong",
};

export function DeckCard({ title, dueCount, cardCount, status, onPress }: DeckCardProps) {
  const accent = accentFor(title);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: accent.bg }, pressed && { opacity: 0.9 }]}>
      <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
        <BlobMascot color={accent.fg} size={40} withFace={false} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={typography.h2} numberOfLines={1}>
          {title}
        </Text>
        {status !== "ready" ? (
          <Text style={[typography.caption, { color: accent.fg }]}>{STATUS_LABEL[status]}</Text>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted }]}>{cardCount} cards in this lecture</Text>
        )}
      </View>
      {status === "ready" && dueCount > 0 && (
        <View style={[styles.badge, { backgroundColor: accent.fg }]}>
          <Text style={styles.badgeText}>{dueCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...typography.caption, color: "#fff" },
});
