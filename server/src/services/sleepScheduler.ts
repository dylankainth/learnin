// Schedule reviews to occur before sleep for optimal consolidation

export function scheduleSleepOptimized(dueDateMs: number, sleepTime: string, wakeTime: string): Date {
  // Parse times as "HH:MM" (24h format)
  const [sleepHour, sleepMin] = sleepTime.split(":").map(Number);
  const [wakeHour, wakeMin] = wakeTime.split(":").map(Number);

  const dueDate = new Date(dueDateMs);
  const now = new Date();

  // If due date is today, check if we can schedule before sleep
  if (isSameDay(dueDate, now)) {
    const sleepTimeToday = getTimeOnDate(dueDate, sleepHour, sleepMin);
    const wakeTimeToday = getTimeOnDate(dueDate, wakeHour, wakeMin);

    // If not yet at wake time, move to tonight's sleep
    if (now < wakeTimeToday) {
      return new Date(sleepTimeToday.getTime() - 30 * 60 * 1000); // 30 min before sleep
    }

    // If after wake but before sleep, target tonight's sleep
    if (now < sleepTimeToday) {
      return new Date(sleepTimeToday.getTime() - 30 * 60 * 1000);
    }

    // After sleep, target next morning after wake
    const nextWake = new Date(wakeTimeToday);
    nextWake.setDate(nextWake.getDate() + 1);
    return new Date(nextWake.getTime() + 30 * 60 * 1000); // 30 min after wake
  }

  // For future dates, schedule 30 min before their sleep time
  const scheduledSleep = getTimeOnDate(dueDate, sleepHour, sleepMin);
  return new Date(scheduledSleep.getTime() - 30 * 60 * 1000);
}

function getTimeOnDate(date: Date, hour: number, minute: number): Date {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
