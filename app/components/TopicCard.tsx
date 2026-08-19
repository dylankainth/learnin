import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { colors, accentFor } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "./BlobMascot";

interface TopicCardProps {
  id: string;
  name: string;
  description?: string;
  contentCount: number;
  dueCount: number;
  cardCount: number;
  onPress: () => void;
}

export function TopicCard({ name, description, contentCount, dueCount, cardCount, onPress }: TopicCardProps) {
  const accent = accentFor(name);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: accent.bg }, pressed && { opacity: 0.9 }]}>
      <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
        <BlobMascot color={accent.fg} size={40} withFace={false} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={typography.h2} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {contentCount} item{contentCount !== 1 ? "s" : ""} • {cardCount} cards
        </Text>
        {description && (
          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      {dueCount > 0 && (
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
