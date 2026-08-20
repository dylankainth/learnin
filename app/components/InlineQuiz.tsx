import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import type { QuizBlockView } from "@/lib/types";

/** Ungraded comprehension check shown inline while reading — the real spaced-repetition scoring happens later in a review session. */
export function InlineQuiz({ block }: { block: QuizBlockView }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [revealed, setRevealed] = useState(false);

  const isCorrect = block.options ? selected === block.answer : null;

  return (
    <View style={styles.card}>
      <Text style={[typography.caption, { color: colors.primary }]}>QUICK CHECK</Text>
      <Text style={[typography.h2, { marginTop: 6 }]}>{block.question}</Text>

      {block.options ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          {block.options.map((opt) => {
            const isSelected = selected === opt;
            const showAsCorrect = revealed && opt === block.answer;
            const showAsWrong = revealed && isSelected && opt !== block.answer;
            return (
              <Pressable
                key={opt}
                disabled={revealed}
                onPress={() => setSelected(opt)}
                style={[
                  styles.option,
                  isSelected && !revealed && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                  showAsCorrect && { borderColor: colors.success, backgroundColor: colors.tealLight },
                  showAsWrong && { borderColor: colors.danger, backgroundColor: "#FEE2E2" },
                ]}
              >
                <Text style={typography.body}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          style={styles.freeInput}
          placeholder="Type your answer…"
          placeholderTextColor={colors.textMuted}
          value={freeText}
          onChangeText={setFreeText}
          editable={!revealed}
          multiline
        />
      )}

      {!revealed ? (
        <Pressable
          style={[styles.submit, !(selected || freeText) && { opacity: 0.5 }]}
          disabled={!(selected || freeText)}
          onPress={() => setRevealed(true)}
        >
          <Text style={[typography.button, { color: "#fff" }]}>Check</Text>
        </Pressable>
      ) : (
        <View style={styles.explanation}>
          {block.options && (
            <Text style={[typography.bodyMedium, { color: isCorrect ? colors.success : colors.danger }]}>
              {isCorrect ? "Correct!" : `Not quite — the answer is "${block.answer}"`}
            </Text>
          )}
          {!block.options && <Text style={typography.bodyMedium}>Model answer: {block.answer}</Text>}
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>{block.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    padding: 18,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: colors.surface,
  },
  freeInput: {
    marginTop: 14,
    minHeight: 70,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 14,
    ...typography.body,
    textAlignVertical: "top",
  },
  submit: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  explanation: { marginTop: 14 },
});
