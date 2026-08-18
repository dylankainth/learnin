import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET"),
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "https://github.com/dylankainth/learnin",
  openRouterAppName: process.env.OPENROUTER_APP_NAME ?? "Learnin",
  whisperApiUrl: process.env.WHISPER_API_URL,
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
};
