import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

type QuestionType = "multiple-choice" | "free-text" | "cloze" | "true-false";

interface QuestionRendererProps {
  type: QuestionType;
  question: string;
  options?: string[];
  selectedOption?: string | null;
  revealed: boolean;
  answer: string;
  onSelectOption?: (option: string) => void;
  onTextChange?: (text: string) => void;
  userText?: string;
}

export function QuestionRenderer({
  type,
  question,
  options = [],
  selectedOption,
  revealed,
  answer,
  onSelectOption,
  onTextChange,
  userText = "",
}: QuestionRendererProps) {
  if (type === "multiple-choice" || type === "true-false") {
    return (
      <View style={{ gap: 12 }}>
        {options.map((opt) => {
          const isSelected = selectedOption === opt;
          const showCorrect = revealed && opt === answer;
          const showWrong = revealed && isSelected && opt !== answer;
          return (
            <Pressable
              key={opt}
              disabled={revealed}
              onPress={() => onSelectOption?.(opt)}
              style={[
                styles.option,
                isSelected && !revealed && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                showCorrect && { borderColor: colors.success, backgroundColor: colors.tealLight },
                showWrong && { borderColor: colors.danger, backgroundColor: "#FEE2E2" },
              ]}
            >
              <Text style={typography.body}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (type === "cloze") {
    return (
      <View style={{ gap: 12 }}>
        <Text style={typography.h2}>{question}</Text>
        {!revealed ? (
          <TextInput
            style={styles.textInput}
            placeholder="Type the missing word..."
            placeholderTextColor={colors.textMuted}
            value={userText}
            onChangeText={onTextChange}
            editable={!revealed}
          />
        ) : (
          <View style={[styles.clozeAnswer, { backgroundColor: colors.tealLight }]}>
            <Text style={[typography.bodyMedium, { color: colors.text }]}>{answer}</Text>
          </View>
        )}
      </View>
    );
  }

  // free-text
  return (
    <View style={{ gap: 12 }}>
      <Text style={typography.h2}>{question}</Text>
      {!revealed ? (
        <TextInput
          style={[styles.textInput, styles.textAreaInput]}
          placeholder="Type your answer..."
          placeholderTextColor={colors.textMuted}
          value={userText}
          onChangeText={onTextChange}
          editable={!revealed}
          multiline
          numberOfLines={3}
        />
      ) : (
        <View style={styles.answerBox}>
          <Text style={typography.body}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    backgroundColor: colors.surface,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: "top",
  },
  clozeAnswer: {
    borderRadius: radii.md,
    padding: 14,
  },
  answerBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 16,
  },
});
