import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

interface ElaborationPromptProps {
  prompt: string;
  onSubmit?: (reflection: string) => void;
}

export function ElaborationPrompt({ prompt, onSubmit }: ElaborationPromptProps) {
  const [reflection, setReflection] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (reflection.trim()) {
      onSubmit?.(reflection);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={[typography.caption, { color: colors.success }]}>✓ Reflection saved</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 10 }]}>REFLECT</Text>
      <Text style={[typography.body, { marginBottom: 12 }]}>{prompt}</Text>
      <TextInput
        style={styles.input}
        placeholder="Your thoughts..."
        placeholderTextColor={colors.textMuted}
        value={reflection}
        onChangeText={setReflection}
        multiline
        numberOfLines={2}
      />
      <Pressable style={[styles.btn, !reflection.trim() && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!reflection.trim()}>
        <Text style={[typography.caption, { color: "#fff" }]}>Save Reflection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    color: colors.text,
    marginBottom: 10,
    minHeight: 60,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
});
