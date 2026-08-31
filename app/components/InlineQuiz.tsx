import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { cleanLatexSymbols } from "@/lib/latexCleanup";
import type { QuizBlockView } from "@/lib/types";

/** Ungraded comprehension check shown inline while reading — the real spaced-repetition scoring happens later in a review session. */
export function InlineQuiz({ block }: { block: QuizBlockView }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [revealed, setRevealed] = useState(false);

  const isCorrect = block.options ? selected === block.answer : null;

  // This block renders as plain text, not markdown, so clean any stray
  // LaTeX (\Sigma, \langle, ...) that slipped into already-generated content.
  const question = useMemo(() => cleanLatexSymbols(block.question), [block.question]);
  const answer = useMemo(() => cleanLatexSymbols(block.answer), [block.answer]);
  const explanation = useMemo(() => cleanLatexSymbols(block.explanation), [block.explanation]);
  const options = useMemo(() => block.options?.map(cleanLatexSymbols) ?? null, [block.options]);

  return (
    <View style={styles.card}>
      <Text style={[typography.h2, { marginBottom: 2 }]}>{question}</Text>

      {options ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          {options.map((opt, i) => {
            const rawOpt = block.options![i];
            const isSelected = selected === rawOpt;
            const showAsCorrect = revealed && rawOpt === block.answer;
            const showAsWrong = revealed && isSelected && rawOpt !== block.answer;
            return (
              <Pressable
                key={rawOpt}
                disabled={revealed}
                onPress={() => setSelected(rawOpt)}
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
          {options && (
            <Text style={[typography.bodyMedium, { color: isCorrect ? colors.success : colors.danger }]}>
              {isCorrect ? "Correct!" : `Not quite — the answer is "${answer}"`}
            </Text>
          )}
          {!options && <Text style={typography.bodyMedium}>Model answer: {answer}</Text>}
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>{explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
