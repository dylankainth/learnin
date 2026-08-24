import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Markdown, { renderRules } from "react-native-markdown-display";
import { api } from "@/lib/api";
import { colors } from "@/theme/colors";
import { fonts, serifFonts } from "@/theme/typography";

function TappableItem({
  children,
  isRead,
  onToggle,
}: {
  children: React.ReactNode;
  isRead: boolean;
  onToggle: () => void;
}) {
  const textOpacity = useRef(new Animated.Value(isRead ? 0.3 : 1)).current;
  const tickOpacity = useRef(new Animated.Value(isRead ? 1 : 0)).current;
  const tickScale = useRef(new Animated.Value(isRead ? 1 : 0.4)).current;
  const prevIsRead = useRef(isRead);

  useEffect(() => {
    if (prevIsRead.current === isRead) return;
    prevIsRead.current = isRead;

    if (isRead) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(tickScale, { toValue: 1, bounciness: 14, useNativeDriver: true }),
          Animated.timing(tickOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
        Animated.timing(textOpacity, { toValue: 0.3, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(tickOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.spring(tickScale, { toValue: 0.4, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isRead]);

  return (
    <Pressable onPress={onToggle}>
      <View style={{ position: "relative" }}>
        <Animated.View style={{ opacity: textOpacity }}>
          {children}
        </Animated.View>
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            opacity: tickOpacity,
            transform: [{ scale: tickScale }],
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 80, color: colors.text, opacity: 0.13, fontFamily: fonts.bold }}>✓</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

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
    fontWeight: "normal" as const,
  },
  em: {
    fontFamily: serifFonts.italic,
    fontStyle: "normal" as const,
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

export function InlineMarkdown({
  text,
  blockId,
  readParagraphs = [],
  onStatsChange,
}: {
  text: string;
  blockId?: string;
  readParagraphs?: number[];
  onStatsChange?: (total: number, read: number) => void;
}) {
  const [readSet, setReadSet] = useState<Set<number>>(() => new Set(readParagraphs));
  const elementCounter = useRef(0);

  const serialized = readParagraphs.slice().sort((a, b) => a - b).join(",");
  useEffect(() => {
    setReadSet(new Set(readParagraphs));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  useEffect(() => {
    onStatsChange?.(elementCounter.current, readSet.size);
  // onStatsChange is stable (useCallback in parent); elementCounter.current is set during render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readSet.size]);

  const toggleElement = useCallback(
    (index: number) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
      if (blockId) {
        api.blocks.toggleParagraph(blockId, index).catch((err) => {
          console.error("toggleParagraph failed:", err);
        });
      }
    },
    [blockId],
  );

  const rules = useMemo(
    () => ({
      paragraph: (node: any, children: React.ReactNode, _parent: any, styles: any) => {
        const index = elementCounter.current++;
        const isRead = readSet.has(index);
        return (
          <TappableItem key={node.key} isRead={isRead} onToggle={() => toggleElement(index)}>
            <View style={styles._VIEW_SAFE_paragraph}>{children}</View>
          </TappableItem>
        );
      },
      list_item: (node: any, children: React.ReactNode, parent: any, styles: any, inheritedStyles: any) => {
        const index = elementCounter.current++;
        const isRead = readSet.has(index);
        return (
          <TappableItem key={node.key} isRead={isRead} onToggle={() => toggleElement(index)}>
            {(renderRules.list_item as any)(node, children, parent, styles, inheritedStyles)}
          </TappableItem>
        );
      },
    }),
    [readSet, toggleElement],
  );

  elementCounter.current = 0;

  return (
    <Markdown style={markdownStyles} rules={rules}>
      {text}
    </Markdown>
  );
}
