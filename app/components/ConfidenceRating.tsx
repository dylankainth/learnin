import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

interface ConfidenceRatingProps {
  value: number | null;
  onChange: (value: number) => void;
}

const CONFIDENCE_LABELS = ["Very unsure", "Unsure", "Neutral", "Confident", "Very confident"];

export function ConfidenceRating({ value, onChange }: ConfidenceRatingProps) {
  return (
    <View style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 12 }]}>
        Before you check: How confident are you?
      </Text>
      <View style={styles.scale}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Pressable
            key={rating}
            onPress={() => onChange(rating)}
            style={[styles.button, value === rating && styles.buttonSelected]}
          >
            <Text
              style={[
                typography.caption,
                {
                  color: value === rating ? colors.primary : colors.textMuted,
                  fontWeight: value === rating ? "600" : "400",
                },
              ]}
            >
              {rating}
            </Text>
          </Pressable>
        ))}
      </View>
      {value && <Text style={[typography.caption, { color: colors.text, marginTop: 8 }]}>{CONFIDENCE_LABELS[value - 1]}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  scale: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
});
