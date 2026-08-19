import { Router } from "express";
import { z } from "zod";
import { getOrCreateNotificationPrefs, pb } from "../services/pocketbase.js";
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
  const prefs = await getOrCreateNotificationPrefs(req.userId!);
  await pb.collection("notification_prefs").update(prefs.id, { expo_push_token: parsed.data.expoPushToken });
  res.status(204).send();
});

const prefsSchema = z.object({
  enabled: z.boolean().optional(),
  reminderHourLocal: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
});

notificationsRouter.get("/prefs", async (req: AuthedRequest, res) => {
  const prefs = await getOrCreateNotificationPrefs(req.userId!);
  res.json({
    prefs: { enabled: prefs.enabled, reminder_hour_local: prefs.reminder_hour_local, timezone: prefs.timezone },
  });
});

notificationsRouter.patch("/prefs", async (req: AuthedRequest, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { enabled, reminderHourLocal, timezone } = parsed.data;
  const prefs = await getOrCreateNotificationPrefs(req.userId!);

  const patch: Record<string, unknown> = {};
  if (enabled !== undefined) patch.enabled = enabled;
  if (reminderHourLocal !== undefined) patch.reminder_hour_local = reminderHourLocal;
  if (timezone !== undefined) patch.timezone = timezone;
  await pb.collection("notification_prefs").update(prefs.id, patch);

  res.status(204).send();
});
