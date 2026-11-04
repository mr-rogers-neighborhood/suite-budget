import {
  addDays,
  addMonths,
  type DateKey,
  dateKey,
  daysInMonth,
  monthKeyOf,
  partsOfDateKey,
} from "./dates";
import type { ScheduleFrequency } from "./schema";

/** The next date after `from`, keeping a monthly anchor day when one is supplied. */
export function nextOccurrence(
  from: DateKey,
  frequency: ScheduleFrequency,
  interval: number,
  anchorDate: DateKey = from,
): DateKey {
  const step = Math.max(1, interval);
  if (frequency === "daily") return addDays(from, step);
  if (frequency === "weekly") return addDays(from, 7 * step);

  const anchor = partsOfDateKey(anchorDate);
  if (frequency === "monthly") {
    const month = addMonths(monthKeyOf(from), step);
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return from;
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    return dateKey(year, monthNumber, Math.min(anchor.day, daysInMonth(year, monthNumber)));
  }

  const year = partsOfDateKey(from).year + step;
  const safeDay = Math.min(anchor.day, daysInMonth(year, anchor.month));
  return dateKey(year, anchor.month, safeDay);
}

export function occurrencesBetween(
  start: DateKey,
  end: DateKey,
  frequency: ScheduleFrequency,
  interval: number,
  anchorDate: DateKey = start,
  limit = 500,
): DateKey[] {
  const dates: DateKey[] = [];
  let cursor = start;
  let count = 0;
  while (cursor <= end && count < limit) {
    dates.push(cursor);
    cursor = nextOccurrence(cursor, frequency, interval, anchorDate);
    count += 1;
  }
  return dates;
}
