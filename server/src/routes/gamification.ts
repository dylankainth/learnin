import { Router } from "express";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { calculateXP, checkBadges } from "../services/gamification.js";

export const gamificationRouter = Router();
gamificationRouter.use(requireAuth);

gamificationRouter.get("/stats", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  let stats;
  try {
    stats = await pb.collection("user_stats").getFirstListItem(pb.filter("user_id = {:uid}", { uid: req.userId }));
  } catch {
    // Create default stats if missing
    stats = await pb.collection("user_stats").create({
      user_id: req.userId,
      xp: 0,
      badges: [],
      daily_goal_cards: 20,
      cards_reviewed_today: 0,
      goal_completed_today: false,
      last_review_date: new Date(),
    });
  }

  res.json({
    xp: stats.xp,
    badges: stats.badges,
    dailyGoal: stats.daily_goal_cards,
    cardsReviewedToday: stats.cards_reviewed_today,
    goalCompleted: stats.goal_completed_today,
  });
});

gamificationRouter.patch("/daily-goal", async (req: AuthedRequest, res) => {
  const { goal } = req.body;
  if (!goal || goal < 5 || goal > 100) {
    res.status(400).json({ error: "Goal must be between 5 and 100" });
    return;
  }

  await ensureSuperuserAuth();

  let stats;
  try {
    stats = await pb.collection("user_stats").getFirstListItem(pb.filter("user_id = {:uid}", { uid: req.userId }));
  } catch {
    stats = await pb.collection("user_stats").create({
      user_id: req.userId,
      xp: 0,
      badges: [],
      daily_goal_cards: goal,
      cards_reviewed_today: 0,
      goal_completed_today: false,
      last_review_date: new Date(),
    });
    res.json({ dailyGoal: goal });
    return;
  }

  await pb.collection("user_stats").update(stats.id, { daily_goal_cards: goal });
  res.json({ dailyGoal: goal });
});
