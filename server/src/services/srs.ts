// SM-2 based spaced-repetition scheduler (the same family of algorithm
// Anki/SuperMemo use). Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy.

export type Rating = 1 | 2 | 3 | 4;

export interface CardState {
  easeFactor: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends CardState {
  dueAt: Date;
}

const MIN_EASE = 1.3;

export function schedule(card: CardState, rating: Rating, now: Date = new Date()): ScheduleResult {
  let { easeFactor, intervalDays, reps, lapses } = card;

  if (rating === 1) {
    // Forgotten: reset progress, come back soon (same-session relearning).
    reps = 0;
    lapses += 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    const dueAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    return { easeFactor, intervalDays: 10 / (60 * 24), reps, lapses, dueAt };
  }

  if (rating === 2) {
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
    intervalDays = Math.max(1, intervalDays * 1.2);
  } else if (rating === 3) {
    if (reps === 0) intervalDays = 1;
    else if (reps === 1) intervalDays = 6;
    else intervalDays = intervalDays * easeFactor;
    reps += 1;
  } else {
    easeFactor = easeFactor + 0.15;
    intervalDays = reps === 0 ? 4 : intervalDays * easeFactor * 1.3;
    reps += 1;
  }

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { easeFactor, intervalDays, reps, lapses, dueAt };
}
