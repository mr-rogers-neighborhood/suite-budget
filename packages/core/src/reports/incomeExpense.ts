import type { MonthKey } from "../dates";
import { buildLedger } from "../plan/ledger";
import type { BudgetSnapshot } from "../schema";

export type IncomeExpensePoint = {
  month: MonthKey;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

export function incomeExpenseSeries(
  snapshot: BudgetSnapshot,
  months: readonly MonthKey[],
): IncomeExpensePoint[] {
  if (months.length === 0) return [];
  const ledger = buildLedger(snapshot, months[months.length - 1] ?? months[0] ?? "");
  return months.map((month) => {
    const income = ledger.incomeByMonth.get(month) ?? 0;
    let categorized = 0;
    for (const amount of ledger.activityByMonth.get(month)?.values() ?? []) categorized += amount;
    const uncategorized = ledger.uncategorizedByMonth.get(month)?.amountMinor ?? 0;
    const expense = Math.max(0, -(categorized + Math.min(0, uncategorized)));
    return {
      month,
      incomeMinor: income,
      expenseMinor: expense,
      netMinor: income - expense,
    };
  });
}
