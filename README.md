# Learnin

Turn lecture PDFs and recordings into a quantum.country-style long-form explainer with
inline quizzes, then commit it to memory with spaced-repetition reviews and reminders.

## Structure

- `server/` — Express API + BullMQ ingestion worker (Postgres + Redis), deployed via Docker Compose.
- `app/` — Expo (React Native) Android app, expo-router based.

## Running the backend

```bash
cd server
cp .env.example .env   # fill in OPENROUTER_API_KEY, JWT_SECRET, etc.
cd ..
docker compose up --build
```

This starts Postgres, Redis, the API (`:4000`), and the ingestion worker. The worker
picks up uploaded lectures, extracts text (PDF via `pdf-parse`, video via a
self-hosted Whisper-compatible server — see `WHISPER_API_URL` in `.env.example`),
and calls an LLM via [OpenRouter](https://openrouter.ai) to generate the explainer + quiz document.

Video transcription is optional: leave `WHISPER_API_URL` unset to support PDF-only
uploads, or uncomment the `whisper` service in `docker-compose.yml` to self-host one.

## Running the app

```bash
cd app
npm install
npx expo start --android
```

Point it at your backend by setting `extra.apiUrl` in `app/app.json` (defaults to
`http://localhost:4000`, which only works from an Android emulator via `10.0.2.2` —
set it to your VPS's address for a real device).

## Design

The UI is a from-scratch design system (`app/theme`, `app/components`) inspired by the
soft rounded, pastel "habit tracker" aesthetic you shared — hand-drawn blob mascots
(`BlobMascot.tsx`) rather than a third-party illustration pack, so there's no licensing
question and the style is fully ours to evolve.

## Notes on the generation pipeline

`server/src/services/llm.ts` turns raw lecture text into an ordered list of
explainer/quiz blocks via structured JSON output (schema generated from the zod
types, so the response is validated, not just hoped-for). A single lecture is
generated in one call (keeps it coherent); very long sources are chunked with a
rolling summary carried forward between calls. Quiz cards get their own
spaced-repetition state (`server/src/services/srs.ts`, an SM-2 variant) independent
of the document — the inline quiz you see while reading is an ungraded comprehension
check, and the real scheduled reviews happen in the Review tab.

Model is set via `OPENROUTER_MODEL` in `.env` — swap it any time, no code changes.

| Model | Input / output ($ per M tokens) | Context | Why |
|---|---|---|---|
| `google/gemini-2.5-flash` (default) | $0.30 / $2.50 | 1M | Best balance for this job — huge context (fits a whole lecture transcript in one call), reliable structured-JSON output, good writing quality for explainer prose. |
| `google/gemini-2.5-flash-lite` | cheaper still | 1M | Drop-in if you want to cut cost further and can tolerate slightly rougher prose/quiz quality. |
| `deepseek/deepseek-v3.2` | ~$0.21 / $0.31 | large | Cheapest of the credible options — open-weight, strong general capability, worth trying if volume is high and you're comfortable validating quiz quality yourself. |

Avoid tiny/heavily-quantized free models for this task — generating well-scoped
quiz questions from a full lecture needs decent instruction-following and JSON
reliability, and free-tier models on OpenRouter are inconsistent on both.
