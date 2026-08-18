import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const registerSchema = z.object({ expoPushToken: z.string().min(1) });

notificationsRouter.post("/register", async (req: AuthedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await pool.query("UPDATE notification_prefs SET expo_push_token = $1 WHERE user_id = $2", [
    parsed.data.expoPushToken,
    req.userId,
  ]);
  res.status(204).send();
});

const prefsSchema = z.object({
  enabled: z.boolean().optional(),
  reminderHourLocal: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
});

notificationsRouter.get("/prefs", async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    "SELECT enabled, reminder_hour_local, timezone FROM notification_prefs WHERE user_id = $1",
    [req.userId],
  );
  res.json({ prefs: rows[0] ?? null });
});

notificationsRouter.patch("/prefs", async (req: AuthedRequest, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { enabled, reminderHourLocal, timezone } = parsed.data;
  await pool.query(
    `UPDATE notification_prefs SET
       enabled = COALESCE($1, enabled),
       reminder_hour_local = COALESCE($2, reminder_hour_local),
       timezone = COALESCE($3, timezone)
     WHERE user_id = $4`,
    [enabled ?? null, reminderHourLocal ?? null, timezone ?? null, req.userId],
  );
  res.status(204).send();
});
