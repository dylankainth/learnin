import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography, fonts } from "@/theme/typography";

// ── Inline span parser ──────────────────────────────────────────────────────

type InlineSpan =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "bolditalic"; value: string }
  | { kind: "code"; value: string };

function parseInline(raw: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  // Matches (in order): ***…***, **…**, *…*, `…`
  const re = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) spans.push({ kind: "text", value: raw.slice(last, m.index) });
    if (m[2] !== undefined) spans.push({ kind: "bolditalic", value: m[2] });
    else if (m[3] !== undefined) spans.push({ kind: "bold", value: m[3] });
    else if (m[4] !== undefined) spans.push({ kind: "italic", value: m[4] });
    else if (m[5] !== undefined) spans.push({ kind: "code", value: m[5] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) spans.push({ kind: "text", value: raw.slice(last) });
  return spans;
}

function InlineSpans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        switch (s.kind) {
          case "bold":
            return <Text key={i} style={styles.bold}>{s.value}</Text>;
          case "italic":
            return <Text key={i} style={styles.italic}>{s.value}</Text>;
          case "bolditalic":
            return <Text key={i} style={styles.boldItalic}>{s.value}</Text>;
          case "code":
            return <Text key={i} style={styles.inlineCode}>{s.value}</Text>;
          default:
            return <Text key={i}>{s.value}</Text>;
        }
      })}
    </>
  );
}

// ── Block-level parser ───────────────────────────────────────────────────────

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "hr" }
  | { kind: "code"; lang: string; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      blocks.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }

    // Headings
    if (line.startsWith("#### ")) { blocks.push({ kind: "h4", text: line.slice(5) }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ kind: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ kind: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ kind: "h1", text: line.slice(2) }); i++; continue; }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { blocks.push({ kind: "hr" }); i++; continue; }

    // Unordered list
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") { i++; continue; }

    // Paragraph — accumulate until blank line or block-level marker
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4} |```|[-*+] |\d+\. |---|===)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) blocks.push({ kind: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

// ── Renderers ────────────────────────────────────────────────────────────────

function RichText({ text, style }: { text: string; style?: object }) {
  const spans = parseInline(text);
  return <Text style={style}><InlineSpans spans={spans} /></Text>;
}

function ListItem({ text, marker }: { text: string; marker: string }) {
  return (
    <View style={styles.listRow}>
      <Text style={[styles.listMarker, styles.body]}>{marker}</Text>
      <Text style={[styles.body, { flex: 1 }]}>
        <InlineSpans spans={parseInline(text)} />
      </Text>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function InlineMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h1":
            return <RichText key={i} text={block.text} style={[styles.h1, i > 0 && styles.headingTop]} />;
          case "h2":
            return <RichText key={i} text={block.text} style={[styles.h2, i > 0 && styles.headingTop]} />;
          case "h3":
            return <RichText key={i} text={block.text} style={[styles.h3, i > 0 && styles.headingTopSm]} />;
          case "h4":
            return <RichText key={i} text={block.text} style={[styles.h4, i > 0 && styles.headingTopSm]} />;
          case "hr":
            return <View key={i} style={styles.hr} />;
          case "code":
            return (
              <View key={i} style={styles.codeBlock}>
                {block.lang ? <Text style={styles.codeLang}>{block.lang}</Text> : null}
                <Text style={styles.codeText}>{block.text}</Text>
              </View>
            );
          case "ul":
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => <ListItem key={j} text={item} marker="•" />)}
              </View>
            );
          case "ol":
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => <ListItem key={j} text={item} marker={`${j + 1}.`} />)}
              </View>
            );
          case "p":
            return <RichText key={i} text={block.text} style={[styles.body, i > 0 && styles.paraTop]} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  h1: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.text,
    marginBottom: 12,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: 10,
  },
  h3: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.1,
    color: colors.text,
    marginBottom: 6,
  },
  h4: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 4,
  },
  headingTop: { marginTop: 32 },
  headingTopSm: { marginTop: 20 },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 27,
    color: colors.text,
  },
  paraTop: { marginTop: 14 },
  bold: { fontFamily: fonts.bold },
  italic: { fontFamily: fonts.regular, fontStyle: "italic" },
  boldItalic: { fontFamily: fonts.bold, fontStyle: "italic" },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: 14,
    backgroundColor: colors.surfaceMuted,
    color: colors.primary,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  codeBlock: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    padding: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  codeLang: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#6E7691",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 21,
    color: "#CDD6F4",
  },
  hr: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  list: { marginTop: 10, gap: 8 },
  listRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  listMarker: {
    width: 18,
    color: colors.textMuted,
    paddingTop: 1,
  },
});
