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
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  pocketbaseUrl: required("POCKETBASE_URL", "http://pocketbase:8090"),
  pocketbaseAdminEmail: required("PB_ADMIN_EMAIL"),
  pocketbaseAdminPassword: required("PB_ADMIN_PASSWORD"),
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "https://github.com/dylankainth/learnin",
  openRouterAppName: process.env.OPENROUTER_APP_NAME ?? "Learnin",
  whisperApiUrl: process.env.WHISPER_API_URL,
};
