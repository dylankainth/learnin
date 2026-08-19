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
}

async function upsertCollection(name: string, fields: FieldDef[], type: "base" | "auth" = "base"): Promise<void> {
  let existing: { id: string; fields: FieldDef[] } | null = null;
  try {
    existing = (await pb.collections.getOne(name)) as unknown as { id: string; fields: FieldDef[] };
  } catch {
    existing = null;
  }

  if (!existing) {
    await pb.collections.create({ name, type, fields });
    return;
  }

  const existingNames = new Set(existing.fields.map((f) => f.name));
  const missing = fields.filter((f) => !existingNames.has(f.name));
  if (missing.length > 0) {
    await pb.collections.update(existing.id, { fields: [...existing.fields, ...missing] });
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

  await upsertCollection("documents", [
    { name: "user_id", type: "text" },
    { name: "title", type: "text" },
    { name: "source_type", type: "text" },
    { name: "original_filename", type: "text" },
    { name: "file", type: "file", maxSelect: 1 },
    { name: "status", type: "text" },
    { name: "error_message", type: "text" },
  ]);

  await upsertCollection("blocks", [
    { name: "document_id", type: "text" },
    { name: "order_index", type: "number" },
    { name: "type", type: "text" },
    { name: "content", type: "json" },
  ]);

  await upsertCollection("cards", [
    { name: "user_id", type: "text" },
    { name: "document_id", type: "text" },
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
}
