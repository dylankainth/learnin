import { Rating } from "./srs.js";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface UserStats {
  xp: number;
  badges: Badge[];
  dailyGoalCards: number;
  cardsReviewedToday: number;
  goalCompletedToday: boolean;
  streak: number;
}

export function calculateXP(rating: Rating, difficulty: number, confidenceCorrect: boolean): number {
  let baseXP = 0;

  // Base XP by rating
  if (rating === 1) baseXP = 0; // Forgot
  else if (rating === 2) baseXP = 5;
  else if (rating === 3) baseXP = 10;
  else baseXP = 15; // Easy

  // Difficulty multiplier
  const difficultyBonus = difficulty === 1 ? 0.8 : difficulty === 3 ? 1.3 : 1;

  // Confidence bonus
  const confidenceBonus = confidenceCorrect ? 1.2 : 1;

  return Math.round(baseXP * difficultyBonus * confidenceBonus);
}

export function checkBadges(stats: { xp: number; cardsReviewedToday: number; streak: number }): Badge[] {
  const badges: Badge[] = [];

  // XP-based badges
  if (stats.xp >= 100) {
    badges.push({
      id: "century",
      name: "Century",
      description: "Earn 100 XP",
      icon: "💯",
    });
  }
  if (stats.xp >= 500) {
    badges.push({
      id: "scholar",
      name: "Scholar",
      description: "Earn 500 XP",
      icon: "🎓",
    });
  }
  if (stats.xp >= 2000) {
    badges.push({
      id: "genius",
      name: "Genius",
      description: "Earn 2000 XP",
      icon: "🧠",
    });
  }

  // Streak-based badges
  if (stats.streak >= 7) {
    badges.push({
      id: "week_warrior",
      name: "Week Warrior",
      description: "7-day study streak",
      icon: "🔥",
    });
  }
  if (stats.streak >= 30) {
    badges.push({
      id: "month_master",
      name: "Month Master",
      description: "30-day study streak",
      icon: "⭐",
    });
  }

  // Daily goal badges
  if (stats.cardsReviewedToday >= 50) {
    badges.push({
      id: "overachiever",
      name: "Overachiever",
      description: "Review 50+ cards in a day",
      icon: "🚀",
    });
  }

  return badges;
}
