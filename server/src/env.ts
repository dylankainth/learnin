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
  jwtSecret: required("JWT_SECRET"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
  whisperApiUrl: process.env.WHISPER_API_URL,
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
};
