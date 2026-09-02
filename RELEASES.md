# Releases

Version history for Sea Sponge. Versions follow `MAJOR.MINOR.PATCH`.
The Android `versionCode` is bumped by one on every release.

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
