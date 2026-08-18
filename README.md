# Learnin

Turn lecture PDFs and recordings into a quantum.country-style long-form explainer with
inline quizzes, then commit it to memory with spaced-repetition reviews and reminders.

## Structure

- `server/` — Express API + BullMQ ingestion worker (Redis + Supabase Postgres), deployed via Docker Compose.
- `app/` — Expo (React Native) Android app, expo-router based.

## Setting up Supabase (accounts + database)

Accounts and the Postgres database both live on [Supabase](https://supabase.com) —
create a free project, then:

1. **Project Settings → API** — copy the Project URL and `anon` `public` key into
   `app/app.json`'s `extra.supabaseUrl` / `extra.supabaseAnonKey` (these are safe to
   ship in the client; access is scoped by the JWT a user gets after logging in).
2. **Project Settings → API → JWT Settings** — copy the JWT Secret into the server's
   `SUPABASE_JWT_SECRET` (used to verify tokens the app sends — see below).
3. **Project Settings → Database → Connection string** — copy the *Session pooler*
   (or direct) connection string into the server's `DATABASE_URL`. Don't use the
   *Transaction pooler* string; this app holds a persistent `pg.Pool`, which
   transaction-mode pgbouncer doesn't support well.
4. **Authentication → Providers → Email** — decide whether to require email
   confirmation (on by default). The app handles both: if confirmation is required,
   signup shows a "check your inbox" screen instead of dropping straight into the app.

The server creates its own tables (`profiles`, `documents`, `blocks`, `cards`,
`reviews`, `notification_prefs`) on boot, keyed off Supabase's built-in `auth.users` —
you don't need to run any SQL by hand. Password reset, email confirmation, and token
refresh are all handled by Supabase Auth; the app talks to it directly via
`@supabase/supabase-js`, and the Express backend only verifies the resulting JWT.

## Running the backend

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, SUPABASE_JWT_SECRET, OPENROUTER_API_KEY, etc.
cd ..
docker compose up --build
```

This starts Redis, the API (`:4000`), and the ingestion worker (no local Postgres —
that's Supabase now). The worker picks up uploaded lectures, extracts text (PDF via
`pdf-parse`, video via a self-hosted Whisper-compatible server — see `WHISPER_API_URL`
in `.env.example`), and calls an LLM via [OpenRouter](https://openrouter.ai) to
generate the explainer + quiz document.

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
set it to your VPS's address for a real device), and `extra.supabaseUrl` /
`extra.supabaseAnonKey` as described above.

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
