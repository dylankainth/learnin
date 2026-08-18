import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { env } from "../env.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.databaseUrl });

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function ensureSchema(): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}
