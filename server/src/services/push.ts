import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import cron from "node-cron";
import { pool } from "../db/index.js";

const expo = new Expo();

export async function sendDueReviewReminders(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT np.user_id, np.expo_push_token, u.name,
            COUNT(c.id) AS due_count
     FROM notification_prefs np
     JOIN profiles u ON u.id = np.user_id
     JOIN cards c ON c.user_id = np.user_id AND c.due_at <= now()
     WHERE np.enabled = true
       AND np.expo_push_token IS NOT NULL
       AND EXTRACT(HOUR FROM now() AT TIME ZONE np.timezone) = np.reminder_hour_local
       AND (np.last_reminded_at IS NULL OR np.last_reminded_at < now() - interval '20 hours')
     GROUP BY np.user_id, np.expo_push_token, u.name`,
  );

  const messages: ExpoPushMessage[] = [];
  for (const row of rows) {
    if (!Expo.isExpoPushToken(row.expo_push_token)) continue;
    messages.push({
      to: row.expo_push_token,
      sound: "default",
      title: "Time to review 🧠",
      body: `${row.due_count} card${row.due_count === "1" ? "" : "s"} due for ${row.name} — a few minutes now saves it for good.`,
      data: { type: "due_reminder" },
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
  await pool.query(
    `UPDATE notification_prefs SET last_reminded_at = now() WHERE user_id = ANY($1::uuid[])`,
    [rows.map((r) => r.user_id)],
  );
}

export function startReminderCron(): void {
  // Runs every 15 minutes; the SQL above only fires per-user once their
  // local reminder hour matches and it's been a day since the last nudge.
  cron.schedule("*/15 * * * *", () => {
    sendDueReviewReminders().catch((err) => console.error("[push] reminder job failed:", err));
  });
}
