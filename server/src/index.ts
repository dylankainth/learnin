import express from "express";
import cors from "cors";
import { ensureCollections } from "./services/pocketbase.js";
import { env } from "./env.js";
import { meRouter } from "./routes/me.js";
import { documentsRouter } from "./routes/documents.js";
import { reviewRouter } from "./routes/review.js";
import { notificationsRouter } from "./routes/notifications.js";
import { progressRouter } from "./routes/progress.js";
import { chatRouter } from "./routes/chat.js";
import { gamificationRouter } from "./routes/gamification.js";
import { startReminderCron } from "./services/push.js";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static('public'));

  // Root endpoint (fallback if no static file matches)
  app.get("/", (_req, res) => res.json({
    app: "learnin",
    status: "running",
    version: "0.1.0"
  }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/download/app.aab", (_req, res) => {
    res.redirect("https://expo.dev/artifacts/eas/zU055cULQt1B7ijXpzepqAJFqGhRSwGoekH0Ujdj7rw.aab");
  });

  app.use("/me", meRouter);
  app.use("/documents", documentsRouter);
  app.use("/review", reviewRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/progress", progressRouter);
  app.use("/chat", chatRouter);
  app.use("/gamification", gamificationRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  startReminderCron();

  app.listen(env.port, () => console.log(`API listening on :${env.port}`));

  // Initialize PocketBase collections asynchronously (non-blocking)
  ensureCollections().catch((err) => {
    console.error("Failed to initialize PocketBase collections:", err);
    console.log("API will continue running but features requiring PocketBase may not work");
  });
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
