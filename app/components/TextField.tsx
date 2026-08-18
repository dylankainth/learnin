import React from "react";
import { TextInput, TextInputProps, View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, typography.body, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 18,
    color: colors.text,
  },
});
