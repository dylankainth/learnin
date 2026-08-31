import React, { useEffect, useMemo, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/theme/colors";
import { getMermaidSource } from "@/lib/mermaidSource";

/**
 * Renders a ```mermaid fenced code block (flowcharts, sequence diagrams,
 * hierarchies, etc.) inline in the study reader.
 *
 * React Native has no DOM for mermaid.js to draw into, so this loads the
 * mermaid.js library — bundled into the app, not fetched from a CDN — into a
 * small WebView and lets it render to SVG there, entirely offline. The page
 * posts its rendered height back once mermaid settles so the WebView (which
 * needs an explicit height) can size itself to the diagram instead of either
 * clipping it or leaving dead space.
 */

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 900;

function escapeForScript(source: string) {
  // Ships the diagram source through a JS template literal in the injected
  // page, so only backticks/backslashes/${ need escaping — not HTML entities.
  return source.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function buildHtml(source: string, mermaidJs: string) {
  const safeSource = escapeForScript(source);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #container { display: flex; justify-content: center; align-items: flex-start; padding: 4px 0; }
  svg { max-width: 100%; height: auto !important; }
  .error { font-family: -apple-system, sans-serif; font-size: 13px; color: ${colors.textMuted}; text-align: center; padding: 20px; }
</style>
</head>
<body>
<div id="container"><pre class="mermaid">${safeSource}</pre></div>
<script>${mermaidJs}</script>
<script>
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function reportHeight() {
    var el = document.getElementById("container");
    var h = el ? el.scrollHeight : 0;
    post({ type: "size", height: h });
  }
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "loose",
      fontFamily: "-apple-system, Helvetica, Arial, sans-serif",
      themeVariables: {
        primaryColor: "${colors.primaryLight}",
        primaryTextColor: "${colors.text}",
        primaryBorderColor: "${colors.primary}",
        lineColor: "${colors.textMuted}",
        secondaryColor: "${colors.surfaceMuted}",
        tertiaryColor: "${colors.surface}",
        fontSize: "15px"
      }
    });
    mermaid
      .run({ querySelector: ".mermaid" })
      .then(function () {
        requestAnimationFrame(function () { requestAnimationFrame(reportHeight); });
      })
      .catch(function () {
        document.getElementById("container").innerHTML = '<div class="error">Couldn\\'t render this diagram</div>';
        post({ type: "error" });
      });
  } catch (e) {
    post({ type: "error" });
  }
</script>
</body>
</html>`;
}

/**
 * Memoized on `source` alone: this sits inside the study reader's paragraph
 * tree, and ticking a paragraph elsewhere in the same explainer re-renders
 * every sibling — without this, that would re-render (and, since the
 * WebView `source` prop below was a fresh object each time, reload and
 * re-run mermaid.js for) every diagram on the page, not just the one that
 * changed. `source` is the only thing that ever actually changes a diagram.
 */
export const MermaidDiagram = React.memo(function MermaidDiagram({ source }: { source: string }) {
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mermaidJs, setMermaidJs] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMermaidSource()
      .then((js) => {
        if (!cancelled) setMermaidJs(js);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(() => (mermaidJs ? buildHtml(source, mermaidJs) : null), [source, mermaidJs]);
  // WebView treats a new `source` object as a fresh page load even when its
  // `html` content is byte-identical, so this has to be its own memo keyed
  // on the string — an inline `source={{ html }}` literal would defeat the
  // React.memo above the moment this component re-renders for any other
  // reason (e.g. the very setHeight/setLoaded call below).
  const webviewSource = useMemo(() => (html ? { html } : null), [html]);

  if (failed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>📊  Diagram couldn't be displayed</Text>
      </View>
    );
  }

  function onMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "size" && typeof data.height === "number") {
        setHeight(Math.max(MIN_HEIGHT, Math.min(data.height + 12, MAX_HEIGHT)));
        setLoaded(true);
      } else if (data.type === "error") {
        setFailed(true);
      }
    } catch {
      // ignore malformed messages
    }
  }

  return (
    <View style={[styles.wrap, { height }]}>
      {webviewSource && (
        <WebView
          originWhitelist={["*"]}
          source={webviewSource}
          style={styles.webview}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
        />
      )}
      {!loaded && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginVertical: 14,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  fallback: {
    width: "100%",
    marginVertical: 14,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
