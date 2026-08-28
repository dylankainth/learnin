import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL || "https://db.learnin.projects.dylankainth.com";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD || "";

interface FieldDef {
  name: string;
  type: "text" | "bool" | "number" | "json" | "file" | "date";
  maxSelect?: number;
}

async function upsertCollection(pb: PocketBase, name: string, fields: FieldDef[], type: "base" | "auth" = "base"): Promise<void> {
  let existing: { id: string; fields: FieldDef[] } | null = null;
  try {
    existing = (await pb.collections.getOne(name)) as unknown as { id: string; fields: FieldDef[] };
  } catch {
    existing = null;
  }

  if (!existing) {
    console.log(`Creating collection: ${name}`);
    await pb.collections.create({ name, type, fields });
    console.log(`✓ Collection created: ${name}`);
    return;
  }

  const existingNames = new Set(existing.fields.map((f) => f.name));
  const missing = fields.filter((f) => !existingNames.has(f.name));
  if (missing.length > 0) {
    console.log(`Adding missing fields to ${name}:`, missing.map((f) => f.name));
    await pb.collections.update(existing.id, { fields: [...existing.fields, ...missing] });
    console.log(`✓ Updated collection: ${name}`);
  } else {
    console.log(`✓ Collection already exists: ${name}`);
  }
}

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error("❌ POCKETBASE_ADMIN_PASSWORD not set!");
    console.log("\nUsage:");
    console.log("  POCKETBASE_ADMIN_EMAIL=admin@example.com POCKETBASE_ADMIN_PASSWORD=your_password npm run migrate");
    process.exit(1);
  }

  const pb = new PocketBase(POCKETBASE_URL);
  pb.autoCancellation(false);

  try {
    console.log(`Connecting to PocketBase at ${POCKETBASE_URL}...`);
    await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("✓ Connected as admin\n");

    // Create topics collection
    await upsertCollection(pb, "topics", [
      { name: "user_id", type: "text" },
      { name: "name", type: "text" },
      { name: "description", type: "text" },
      { name: "color_accent", type: "text" },
      { name: "last_scroll_percent", type: "number" },
      { name: "last_scroll_at", type: "date" },
    ]);

    // Add topic_id to documents if missing
    await upsertCollection(pb, "documents", [
      { name: "user_id", type: "text" },
      { name: "title", type: "text" },
      { name: "source_type", type: "text" },
      { name: "original_filename", type: "text" },
      { name: "file", type: "file", maxSelect: 1 },
      { name: "status", type: "text" },
      { name: "error_message", type: "text" },
      { name: "topic_id", type: "text" },
    ]);

    // Add topic_id to cards if missing
    await upsertCollection(pb, "cards", [
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

    await upsertCollection(pb, "longform_questions", [
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

    console.log("\n✅ Migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

main();
