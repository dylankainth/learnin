// Adapt difficulty based on user accuracy to maintain 70-80% success rate (flow state)

export function calculateTargetDifficulty(recentAccuracy: number): "easy" | "medium" | "hard" {
  // 70-80% is the sweet spot (Leitner's original SM-2 recommendation)
  if (recentAccuracy < 0.5) {
    return "easy"; // User struggling, show easier cards
  }
  if (recentAccuracy < 0.7) {
    return "medium"; // Getting there
  }
  if (recentAccuracy > 0.85) {
    return "hard"; // User mastering, increase difficulty
  }
  return "medium"; // In the zone
}

export function getRecentAccuracy(reviews: Array<{ rating: number }>): number {
  const recent = reviews.slice(-20); // Last 20 reviews
  if (recent.length === 0) return 0.5;

  const correct = recent.filter((r) => r.rating >= 3).length;
  return correct / recent.length;
}

export function shouldInjectEasierCard(documents: Array<{ difficulty?: number; lapseRate?: number }>): boolean {
  const lapseRates = documents.map((d) => d.lapseRate ?? 0);
  const avgLapseRate = lapseRates.reduce((a, b) => a + b, 0) / lapseRates.length;

  // If >30% lapse rate in last 20 reviews, inject easier card
  return avgLapseRate > 0.3;
}
