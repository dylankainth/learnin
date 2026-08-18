import React from "react";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/** Minimal renderer for the explainer prose Claude generates: paragraphs + **bold** spans. */
export function InlineMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <View style={{ gap: 12 }}>
      {paragraphs.map((para, i) => (
        <Text key={i} style={[typography.body, { color: colors.text }]}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <Text key={j} style={typography.bodyMedium}>
                {chunk.slice(2, -2)}
              </Text>
            ) : (
              <Text key={j}>{chunk}</Text>
            ),
          )}
        </Text>
      ))}
    </View>
  );
}
