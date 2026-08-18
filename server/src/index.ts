import express from "express";
import cors from "cors";
import { mkdir } from "fs/promises";
import { ensureSchema } from "./db/index.js";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { documentsRouter } from "./routes/documents.js";
import { reviewRouter } from "./routes/review.js";
import { notificationsRouter } from "./routes/notifications.js";
import { startReminderCron } from "./services/push.js";

async function main() {
  await mkdir(env.uploadDir, { recursive: true });
  await ensureSchema();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/me", meRouter);
  app.use("/documents", documentsRouter);
  app.use("/review", reviewRouter);
  app.use("/notifications", notificationsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  startReminderCron();

  app.listen(env.port, () => console.log(`API listening on :${env.port}`));
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
