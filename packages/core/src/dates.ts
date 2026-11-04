export type DateKey = string;
export type MonthKey = string;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKey(year: number, month: number, day: number): DateKey {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function dateKeyOf(date: Date): DateKey {
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function todayKey(now: Date = new Date()): DateKey {
  return dateKeyOf(now);
}

export function monthKeyOf(value: DateKey): MonthKey {
  return value.slice(0, 7);
}

export function monthKeyOfDate(date: Date): MonthKey {
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad2(date.getMonth() + 1)}`;
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isMonthKey(value: string): boolean {
  const match = MONTH_KEY.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses a date key into its parts without constructing a local Date. */
export function partsOfDateKey(value: DateKey): { year: number; month: number; day: number } {
  const match = DATE_KEY.exec(value);
  if (!match) throw new Error(`Invalid date key: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** A UTC date at noon, so day arithmetic never crosses a local DST boundary. */
export function utcDateOf(value: DateKey): Date {
  const { year, month, day } = partsOfDateKey(value);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function addDays(value: DateKey, days: number): DateKey {
  const date = utcDateOf(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function diffDays(from: DateKey, to: DateKey): number {
  const start = utcDateOf(from).getTime();
  const end = utcDateOf(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const match = MONTH_KEY.exec(month);
  if (!match) throw new Error(`Invalid month key: ${month}`);
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  const monthNumber = (total % 12) + 1;
  return `${String(year).padStart(4, "0")}-${pad2(monthNumber)}`;
}

export function compareMonths(left: MonthKey, right: MonthKey): number {
  return left.localeCompare(right);
}

export function monthsBetween(start: MonthKey, end: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  let current = start;
  while (compareMonths(current, end) <= 0) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

export function endOfMonth(month: MonthKey): DateKey {
  const match = MONTH_KEY.exec(month);
  if (!match) throw new Error(`Invalid month key: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return dateKey(year, monthNumber, daysInMonth(year, monthNumber));
}

export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function monthsRemaining(from: MonthKey, due: MonthKey): number {
  const fromMatch = MONTH_KEY.exec(from);
  const dueMatch = MONTH_KEY.exec(due);
  if (!fromMatch || !dueMatch) return 1;
  const fromTotal = Number(fromMatch[1]) * 12 + Number(fromMatch[2]);
  const dueTotal = Number(dueMatch[1]) * 12 + Number(dueMatch[2]);
  return Math.max(1, dueTotal - fromTotal + 1);
}

export function monthLabel(month: MonthKey): string {
  const match = MONTH_KEY.exec(month);
  if (!match) return month;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1, 12));
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

export function formatDateLabel(value: DateKey): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(utcDateOf(value));
}
