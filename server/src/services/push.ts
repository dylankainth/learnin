import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import cron from "node-cron";
import { ensureSuperuserAuth, pb } from "./pocketbase.js";

const expo = new Expo();

function hourInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).formatToParts(
    date,
  );
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(hour) % 24;
}

export async function sendDueReviewReminders(): Promise<void> {
  await ensureSuperuserAuth();

  const now = new Date();
  const candidatePrefs = await pb.collection("notification_prefs").getFullList({
    filter: 'enabled = true && expo_push_token != ""',
  });

  const eligible = candidatePrefs.filter((prefs) => {
    if (hourInTimezone(now, prefs.timezone || "UTC") !== prefs.reminder_hour_local) return false;
    if (!prefs.last_reminded_at) return true;
    return now.getTime() - new Date(prefs.last_reminded_at).getTime() > 20 * 60 * 60 * 1000;
  });

  if (eligible.length === 0) return;

  const messages: ExpoPushMessage[] = [];
  const remindedPrefIds: string[] = [];

  for (const prefs of eligible) {
    if (!Expo.isExpoPushToken(prefs.expo_push_token)) continue;

    const dueList = await pb.collection("cards").getList(1, 1, {
      filter: pb.filter("user_id = {:uid} && due_at <= {:now}", { uid: prefs.user_id, now }),
      fields: "id",
    });
    if (dueList.totalItems === 0) continue;

    let name = "there";
    try {
      const user = await pb.collection("users").getOne(prefs.user_id);
      name = user.name || "there";
    } catch {
      // user record gone — still send a generic reminder rather than skip
    }

    messages.push({
      to: prefs.expo_push_token,
      sound: "default",
      title: "Time to review 🧠",
      body: `${dueList.totalItems} card${dueList.totalItems === 1 ? "" : "s"} due for ${name} — a few minutes now saves it for good.`,
      data: { type: "due_reminder" },
    });
    remindedPrefIds.push(prefs.id);
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
  await Promise.all(
    remindedPrefIds.map((id) => pb.collection("notification_prefs").update(id, { last_reminded_at: now })),
  );
}

export async function sendQuizCompletionPush(userId: string, failedCount: number): Promise<void> {
  await ensureSuperuserAuth();
  const prefs = await pb.collection("notification_prefs").getFirstListItem(
    pb.filter("user_id = {:uid}", { uid: userId }),
  ).catch(() => null);

  if (!prefs?.expo_push_token || !Expo.isExpoPushToken(prefs.expo_push_token)) return;

  const body = failedCount > 0
    ? `Quiz done! 🧠 ${failedCount} card${failedCount === 1 ? "" : "s"} saved for review — we'll remind you when it's time.`
    : "Perfect score! 🌟 All cards reinforced. Keep it up!";

  await expo.sendPushNotificationsAsync([{
    to: prefs.expo_push_token,
    sound: "default",
    title: "Quiz complete",
    body,
    data: { type: "quiz_complete" },
  }]);
}

export function startReminderCron(): void {
  // Runs every 15 minutes; the filtering above only fires per-user once their
  // local reminder hour matches and it's been a day since the last nudge.
  cron.schedule("*/15 * * * *", () => {
    sendDueReviewReminders().catch((err) => console.error("[push] reminder job failed:", err));
  });
}
