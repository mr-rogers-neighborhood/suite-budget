import { addMonths, type MonthKey, monthKeyOfDate, monthsBetween } from "../dates";
import { buildLedger } from "../plan/ledger";
import type { BudgetSnapshot, ReportRange } from "../schema";

export function monthsForRange(
  snapshot: BudgetSnapshot,
  range: ReportRange,
  now: Date = new Date(),
): MonthKey[] {
  const current = monthKeyOfDate(now);
  if (range === "1m") return [current];
  if (range === "3m") return lastN(current, 3);
  if (range === "6m") return lastN(current, 6);
  if (range === "12m") return lastN(current, 12);
  if (range === "ytd") return monthsBetween(`${current.slice(0, 4)}-01`, current);
  const ledger = buildLedger(snapshot, current);
  return ledger.months.filter((month) => month <= current);
}

function lastN(current: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, index) => addMonths(current, -(count - 1 - index)));
}
