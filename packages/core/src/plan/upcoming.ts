import { addDays, type DateKey } from "../dates";
import { nextOccurrence } from "../recurrence";
import type { BudgetSnapshot, Schedule } from "../schema";

export type UpcomingEntry = {
  schedule: Schedule;
  date: DateKey;
};

export function upcomingEntries(
  snapshot: BudgetSnapshot,
  options: { from: DateKey; days: number; accountId?: string },
): UpcomingEntry[] {
  const through = addDays(options.from, Math.max(1, options.days));
  const entries: UpcomingEntry[] = [];

  for (const schedule of snapshot.schedules) {
    if (options.accountId && schedule.accountId !== options.accountId) continue;
    let cursor = schedule.nextDate;
    let guard = 0;
    while (cursor < options.from && guard < 1000) {
      cursor = nextOccurrence(cursor, schedule.frequency, schedule.interval, schedule.anchorDate);
      guard += 1;
    }
    let count = 0;
    while (cursor <= through && count < 100) {
      if (schedule.endDate && cursor > schedule.endDate) break;
      entries.push({ schedule, date: cursor });
      cursor = nextOccurrence(cursor, schedule.frequency, schedule.interval, schedule.anchorDate);
      count += 1;
    }
  }

  return entries.sort((left, right) => left.date.localeCompare(right.date));
}
