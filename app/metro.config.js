// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The bundled mermaid.js library (see assets/mermaid) is shipped as a plain
// asset — loaded as text and injected into a WebView's <script> tag at
// runtime, never imported as a JS module — so Metro must treat its extension
// as an opaque asset rather than trying to parse it as source.
config.resolver.assetExts.push("mmdjs");

module.exports = config;
