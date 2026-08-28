import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

// Bundled as a plain asset (see metro.config.js) so it ships inside the app
// binary and diagrams render with zero network access — no CDN fetch, no
// "works offline except for this one script tag" gap.
const mermaidAsset = Asset.fromModule(require("../assets/mermaid/mermaid.min.mmdjs"));

let sourcePromise: Promise<string> | null = null;

/**
 * Loads the bundled mermaid.js source text (copied into app-local storage on
 * first use, held in memory after) so it can be injected into a WebView's
 * <script> tag without ever touching the network.
 */
export function getMermaidSource(): Promise<string> {
  if (!sourcePromise) {
    sourcePromise = (async () => {
      await mermaidAsset.downloadAsync();
      const uri = mermaidAsset.localUri ?? mermaidAsset.uri;
      return FileSystem.readAsStringAsync(uri);
    })().catch((err) => {
      sourcePromise = null; // let the next diagram retry instead of caching a permanent failure
      throw err;
    });
  }
  return sourcePromise;
}
