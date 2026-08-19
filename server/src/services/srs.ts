// SM-2 based spaced-repetition scheduler (the same family of algorithm
// Anki/SuperMemo use). Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy.

export type Rating = 1 | 2 | 3 | 4;
export type Confidence = 1 | 2 | 3 | 4 | 5; // 1=very unsure, 5=certain

export interface CardState {
  easeFactor: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends CardState {
  dueAt: Date;
}

export interface CardReview {
  rating: Rating;
  confidencePre?: Confidence;
}

const MIN_EASE = 1.3;

export function schedule(card: CardState, review: CardReview | Rating, now: Date = new Date()): ScheduleResult {
  // Handle both old API (rating only) and new API (review object)
  const rating = typeof review === 'number' ? review : review.rating;
  const confidencePre = typeof review === 'object' ? review.confidencePre : undefined;

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

  // Confidence-based interval adjustment (if provided)
  if (confidencePre !== undefined) {
    const isCorrect = rating >= 3;

    if (confidencePre >= 4 && isCorrect) {
      // High confidence + correct: boost interval
      intervalDays *= 1.4;
    } else if (confidencePre >= 4 && !isCorrect) {
      // High confidence + wrong: penalize more (overconfidence)
      intervalDays *= 0.7;
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.1);
    } else if (confidencePre <= 2 && isCorrect) {
      // Low confidence + correct: normal interval (learned despite doubt)
      // No multiplier
    } else if (confidencePre <= 2 && !isCorrect) {
      // Low confidence + wrong: expected, standard penalty
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.05);
    }
  }

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { easeFactor, intervalDays, reps, lapses, dueAt };
}
