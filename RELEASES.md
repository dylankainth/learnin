# Releases

Version history for Sea Sponge. Versions follow `MAJOR.MINOR.PATCH`.
The Android `versionCode` is bumped by one on every release.

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
