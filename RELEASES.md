# Releases

Version history for Sea Sponge. Versions follow `MAJOR.MINOR.PATCH`.
The Android `versionCode` is bumped by one on every release.

---

## 0.2.6 — 2026-09-02

Android `versionCode` 8.

### New
- **Tap any home-screen stat card for its full history.** Each of the six
  coloured cards now opens a full-screen page in that card's colour, showing
  the metric's headline number and a plain, horizontally scrollable bar chart
  of the last 90 days (reviews/day, retention %, first-try understanding %,
  reading speed, streak on/off, weekly reviews).
- New server endpoint `GET /progress/timeseries?days=` returns per-day review
  counts, correct counts, and first-review counts in one pass over the user's
  review history.
- **"Progress by topic" donut** on the home screen (between the stat cards and
  Next-up): studied cards split by topic, each segment in that topic's accent
  colour, total in the centre, legend beside. Topics list API now returns
  `studied_count` (cards with `reps > 0`) per topic.

---

## 0.2.5 — 2026-09-02

Android `versionCode` 7.

### New
- **Custom launch screen.** The cold-start splash was Expo's default grey
  circles-and-grid placeholder; it's now the winking Spongey on the teal
  (`#9ECEC2`) brand background. Configured via an `expo-splash-screen` plugin
  block in `app.json` (source of truth for prebuild) plus regenerated
  `android/.../drawable-*/splashscreen_logo.png` and the `splashscreen_background`
  colour. (Android 12+ SplashScreen API — icon is masked to a circle, background
  is a solid colour, no custom animation possible.)

---

## 0.2.4 — 2026-09-02

Android `versionCode` 6.

### Packaging
- **R8 class repackaging enabled** (`-repackageclasses ''`) plus
  `-allowaccessmodification`, added to `extraProguardRules` in `app.json`.
  Clears the "Repackage classes" item in Play Console's App optimisation panel
  and lifts obfuscation coverage further. Does not need AGP 9 — that's a plain
  R8 feature on the current AGP 8.8.2.
- Everything else (R8 full mode, resource shrinking, keep rules) unchanged from
  0.2.3. Still needs an on-device retest — repackaging is the one R8 setting
  that can trip a library doing reflection by hardcoded package name.

---

## 0.2.3 — 2026-09-02

Android `versionCode` 5.

### Packaging
- **R8 code shrinking + obfuscation + resource shrinking enabled for release
  builds.** Previously the release build ran no minification, so Play Console
  rated app optimisation "Low" (~2% obfuscation, 19.8 MB uncompressed DEX).
  After R8 the base DEX drops to ~8.8 MB and Play gets a bundled deobfuscation
  map for crash reports.
- Configured through the new **`expo-build-properties`** plugin in `app.json`
  (`android.enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`,
  `extraProguardRules`) so it survives `expo prebuild` — this also moves the
  API-36 SDK pin (added in 0.2.2 by hand-editing `android/`) into `app.json`.
  The `extraProguardRules` block keeps the reflection-heavy native modules:
  React Native bridge, Expo modules, SVG, WebView, AsyncStorage, NetInfo,
  volume-manager, Firebase Cloud Messaging.
- **Smoke-tested on an emulator** with the minified build: onboarding, login,
  home dashboard, topics, topic detail, lecture/markdown rendering, and the
  quiz answer→rating→next flow all work. Still worth a full pass on a physical
  device (notifications, document upload, camera/file pickers) before promoting
  past internal testing.
- AGP 9 / newer R8 optimisations remain gated on a future Expo SDK bump.

---

## 0.2.2 — 2026-09-02

Android `versionCode` 4. First Play Store submission.

### Packaging
- **Application ID is now `com.dylankainth.seasponge`** (was `com.seasponge.app`)
  to match the reserved Play Console listing.
- **Targets Android API 36**, up from 35, as required by Play.
- Release builds are signed with a dedicated upload keystore (`keys/`, gitignored)
  under Google Play App Signing, replacing the debug keystore.

### New
- **Two more home-screen stats** — "day streak" and "reviews this week", each
  with its own mini activity bar.

### Improved
- **All home-screen stat cards are visible at once** — the sideways-scrolling
  strip is now a wrapping grid.
- **Home stat bars use only real review data**, with no sample values mixed in.

### Fixed
- **Profile page still crashed on open in 0.2.0** — `Cannot find native module
  'ExpoApplication'`. `node_modules` was in a partially-installed state that left
  `expo-application` (a transitive dependency of `expo-notifications`) without its
  Android sources, so it was never autolinked. Reinstalled dependencies and
  rebuilt.
- **Study screen didn't return to the exact same spot** after leaving and
  reopening it. Restore was one-shot and ran before the target section's real
  height was known (and before mermaid diagrams above it finished resizing), so
  it landed close but off. It now keeps correcting until the layout above the
  target settles, and prefers the position saved this session over a stale
  server value when the two race.

---

## 0.2.0 — 2026-08-31

Android `versionCode` 2.

### New
- **Multi-file upload.** The upload screen now accepts several files in one go
  instead of one at a time.
- **Teaching-tone lectures.** The lecture generator was rewritten to explain
  material like a teacher talking through it — build intuition first, introduce a
  term only once it's motivated, favour one worked example over a list of names.
- **Trend & curve diagrams.** Sections that describe how something changes over
  time (S-curves, adoption/learning curves, growth or decline) are now drawn as
  `xychart-beta` charts rather than only described in prose.
- **Sectional study rendering.** Long documents paint their first few sections
  immediately and mount the rest in the background, so opening a big lecture is
  fast.
- **New app icon** — the sponge on a teal (`#9ECEC2`) background, with a proper
  Android adaptive icon.

### Improved
- **Scroll restore is block-based.** Your place in a document is saved against a
  section rather than a raw scroll percentage, so it survives content changes and
  the sectional-rendering mount and lands you back in the right spot.
- **Symbol cleanup.** Stray LaTeX commands (`\Sigma`, `\langle`, …) from the model
  are converted to real Unicode symbols across quizzes, lectures, and long-answer
  feedback; the generation prompts now instruct the model not to emit LaTeX in the
  first place.
- **Topic detail auto-refreshes** while resources are still processing — no more
  backing out and in to see them finish.

### Fixed
- **Profile page crash on release builds** — notification setup is now guarded and
  wrapped in an error boundary, so a notifications failure no longer white-screens
  the profile tab in a production APK.
- **Scroll-position restore race** on a quick close-then-reopen of a document.
- **Mermaid diagrams remounting** every time a paragraph was marked read.

---

## 0.1.0

Android `versionCode` 1.

Initial internal build: topic and resource management, spaced-repetition review
with quest/quiz system, section-scoped quizzes, long-answer quizzes with grading,
mermaid diagrams, reading-speed and comprehension stats, offline caching, and
document upload (including the fix for files over PocketBase's 5 MB default).
