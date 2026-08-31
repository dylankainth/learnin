import PocketBase from "pocketbase";
import { env } from "../env.js";

// One shared client for the whole backend (routes + worker), authenticated
// as a PocketBase superuser so it can read/write across all users' records —
// our own route code is what enforces "only your own data", the same way it
// did with a plain unscoped Postgres pool before.
export const pb = new PocketBase(env.pocketbaseUrl);

// The SDK auto-cancels an earlier in-flight request when a duplicate
// (same method+path) request starts — fine for a single browser tab, but
// this client is shared across concurrent Express requests from different
// users, so that behavior would silently cancel unrelated callers' reads.
pb.autoCancellation(false);

let authInFlight: Promise<void> | null = null;

/** Call before any admin operation — cheap no-op once already authenticated. */
export async function ensureSuperuserAuth(): Promise<void> {
  if (pb.authStore.isValid && pb.authStore.isSuperuser) return;
  if (!authInFlight) {
    authInFlight = pb.collection("_superusers")
      .authWithPassword(env.pocketbaseAdminEmail, env.pocketbaseAdminPassword)
      .then(() => undefined)
      .finally(() => {
        authInFlight = null;
      });
  }
  return authInFlight;
}

interface FieldDef {
  name: string;
  type: "text" | "bool" | "number" | "json" | "file" | "date";
  maxSelect?: number;
  maxSize?: number;
}

async function upsertCollection(name: string, fields: FieldDef[], type: "base" | "auth" = "base"): Promise<void> {
  let existing: { id: string; fields: Array<Record<string, unknown>> } | null = null;
  try {
    existing = (await pb.collections.getOne(name)) as unknown as { id: string; fields: Array<Record<string, unknown>> };
  } catch {
    existing = null;
  }

  if (!existing) {
    await pb.collections.create({ name, type, fields });
    return;
  }

  const existingNames = new Set(existing.fields.map((f) => f.name as string));
  const missing = fields.filter((f) => !existingNames.has(f.name));

  // Also reconcile maxSize on fields that already exist — a field is only
  // ever created once, so a later bump here (e.g. the `documents.file`
  // upload cap) would otherwise silently never take effect on a collection
  // that already exists in production, PocketBase's 5MB default and all.
  let sizeChanged = false;
  const reconciled = existing.fields.map((f) => {
    const desired = fields.find((d) => d.name === (f.name as string));
    if (desired?.maxSize !== undefined && (f as { maxSize?: number }).maxSize !== desired.maxSize) {
      sizeChanged = true;
      return { ...f, maxSize: desired.maxSize };
    }
    return f;
  });

  if (missing.length > 0 || sizeChanged) {
    // Merge: keep existing fields as-is (with their PocketBase-assigned ids/options),
    // append only the new fields we need, and carry over any reconciled options.
    await pb.collections.update(existing.id, {
      fields: [...reconciled, ...missing],
    });
    if (missing.length > 0) console.log(`[collections] Added fields to '${name}':`, missing.map((f) => f.name));
    if (sizeChanged) console.log(`[collections] Updated field size limits on '${name}'`);
  }
}

/**
 * There's no signup trigger here the way Postgres/Supabase had one, so the
 * first prefs read/write for a user just creates sane defaults on demand.
 */
export async function getOrCreateNotificationPrefs(userId: string) {
  await ensureSuperuserAuth();
  try {
    return await pb.collection("notification_prefs").getFirstListItem(pb.filter("user_id = {:uid}", { uid: userId }));
  } catch {
    return await pb.collection("notification_prefs").create({
      user_id: userId,
      enabled: true,
      reminder_hour_local: 18,
      timezone: "UTC",
    });
  }
}

/** Idempotently creates/extends the collections this app needs. Safe to call on every boot. */
export async function ensureCollections(): Promise<void> {
  await ensureSuperuserAuth();

  // The built-in `users` auth collection already has email/password/etc —
  // we just extend it with the two extra profile fields we need.
  await upsertCollection(
    "users",
    [
      { name: "name", type: "text" },
      { name: "goal", type: "text" },
    ],
    "auth",
  );

  await upsertCollection("topics", [
    { name: "user_id", type: "text" },
    { name: "name", type: "text" },
    { name: "description", type: "text" },
    { name: "color_accent", type: "text" },
    // Block-based, not pixel-percent: percent-of-scroll-height doesn't
    // transfer across devices with different viewport widths (narrower
    // screens reflow text taller, so "40% down" lands on different content
    // on a phone vs a tablet). A block id is stable across devices — and
    // across content edits too, since it's an anchor, not a position.
    { name: "last_scroll_block_id", type: "text" },
    { name: "last_scroll_fraction", type: "number" },
    { name: "last_scroll_at", type: "date" },
  ]);

  await upsertCollection("documents", [
    { name: "user_id", type: "text" },
    { name: "title", type: "text" },
    { name: "source_type", type: "text" },
    { name: "original_filename", type: "text" },
    { name: "file", type: "file", maxSelect: 1, maxSize: 1024 * 1024 * 1024 }, // 1GB, matches the multer limit in documents.ts
    { name: "status", type: "text" },
    { name: "error_message", type: "text" },
    { name: "topic_id", type: "text" },
    { name: "integration_mode", type: "text" },
  ]);

  await upsertCollection("blocks", [
    { name: "document_id", type: "text" },
    { name: "order_index", type: "number" },
    { name: "type", type: "text" },
    { name: "content", type: "json" },
    { name: "topic_id", type: "text" },
    { name: "topic_order_index", type: "number" },
    { name: "locked", type: "bool" },
  ]);

  await upsertCollection("cards", [
    { name: "user_id", type: "text" },
    { name: "document_id", type: "text" },
    { name: "topic_id", type: "text" },
    { name: "block_id", type: "text" },
    { name: "question", type: "text" },
    { name: "options", type: "json" },
    { name: "answer", type: "text" },
    { name: "explanation", type: "text" },
    { name: "ease_factor", type: "number" },
    { name: "interval_days", type: "number" },
    { name: "reps", type: "number" },
    { name: "lapses", type: "number" },
    { name: "due_at", type: "date" },
    { name: "last_reviewed_at", type: "date" },
    { name: "confidence_pre_rating", type: "number" },
    { name: "question_type", type: "text" },
    { name: "elaboration_prompt", type: "text" },
    { name: "difficulty", type: "number" },
  ]);

  await upsertCollection("reviews", [
    { name: "card_id", type: "text" },
    { name: "user_id", type: "text" },
    { name: "rating", type: "number" },
    { name: "reviewed_at", type: "date" },
  ]);

  await upsertCollection("notification_prefs", [
    { name: "user_id", type: "text" },
    { name: "enabled", type: "bool" },
    { name: "reminder_hour_local", type: "number" },
    { name: "timezone", type: "text" },
    { name: "expo_push_token", type: "text" },
    { name: "last_reminded_at", type: "date" },
  ]);

  await upsertCollection("user_stats", [
    { name: "user_id", type: "text" },
    { name: "xp", type: "number" },
    { name: "badges", type: "json" },
    { name: "daily_goal_cards", type: "number" },
    { name: "cards_reviewed_today", type: "number" },
    { name: "goal_completed_today", type: "bool" },
    { name: "last_review_date", type: "date" },
  ]);

  await upsertCollection("paragraph_reads", [
    { name: "user_id", type: "text" },
    { name: "block_id", type: "text" },
    { name: "paragraph_indices", type: "json" },
  ]);

  await upsertCollection("longform_questions", [
    { name: "user_id", type: "text" },
    { name: "topic_id", type: "text" },
    { name: "document_id", type: "text" },
    { name: "question", type: "text" },
    { name: "key_points", type: "json" },
    { name: "answer", type: "text" },
    { name: "score", type: "number" },
    { name: "verdict", type: "text" },
    { name: "feedback", type: "text" },
    { name: "strengths", type: "json" },
    { name: "missed_points", type: "json" },
    { name: "answered_at", type: "date" },
  ]);
}
