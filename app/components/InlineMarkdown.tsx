import React from "react";
import Markdown from "react-native-markdown-display";
import { colors } from "@/theme/colors";
import { fonts, serifFonts } from "@/theme/typography";

const markdownStyles = {
  body: {
    fontFamily: serifFonts.regular,
    fontSize: 17,
    lineHeight: 29,
    color: colors.text,
    backgroundColor: "transparent",
  },
  heading1: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.text,
    marginTop: 32,
    marginBottom: 12,
  },
  heading2: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: colors.text,
    marginTop: 32,
    marginBottom: 10,
  },
  heading3: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    marginTop: 20,
    marginBottom: 6,
  },
  heading4: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginTop: 16,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: serifFonts.regular,
    fontSize: 17,
    lineHeight: 29,
    color: colors.text,
    marginTop: 0,
    marginBottom: 16,
  },
  strong: {
    fontFamily: serifFonts.bold,
  },
  em: {
    fontFamily: serifFonts.italic,
    fontStyle: "italic" as const,
  },
  code_inline: {
    fontFamily: "monospace",
    fontSize: 14,
    backgroundColor: colors.surfaceMuted,
    color: colors.primary,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    padding: 16,
    marginVertical: 14,
    borderWidth: 0,
  },
  code_block: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 21,
    color: "#CDD6F4",
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    padding: 16,
    marginVertical: 14,
    borderWidth: 0,
  },
  bullet_list: {
    marginBottom: 14,
  },
  ordered_list: {
    marginBottom: 14,
  },
  list_item: {
    fontFamily: serifFonts.regular,
    fontSize: 17,
    lineHeight: 29,
    color: colors.text,
    marginBottom: 4,
  },
  blockquote: {
    backgroundColor: colors.surfaceMuted,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 12,
    borderRadius: 4,
  },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: 24,
  },
};

export function InlineMarkdown({ text }: { text: string }) {
  return (
    <Markdown style={markdownStyles}>
      {text}
    </Markdown>
  );
}
