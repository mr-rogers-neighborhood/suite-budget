import type { MonthKey } from "../dates";
import { buildLedger } from "../plan/ledger";
import type { BudgetSnapshot } from "../schema";
import { incomeExpenseSeries } from "./incomeExpense";

export type CashFlowPoint = {
  month: MonthKey;
  balanceMinor: number;
  incomeMinor: number;
  expenseMinor: number;
};

export function cashFlowSeries(
  snapshot: BudgetSnapshot,
  months: readonly MonthKey[],
): CashFlowPoint[] {
  if (months.length === 0) return [];
  const ledger = buildLedger(snapshot, months[months.length - 1] ?? months[0] ?? "");
  const flows = incomeExpenseSeries(snapshot, months);
  return months.map((month, index) => ({
    month,
    balanceMinor: ledger.onBudgetBalanceByMonth.get(month) ?? 0,
    incomeMinor: flows[index]?.incomeMinor ?? 0,
    expenseMinor: flows[index]?.expenseMinor ?? 0,
  }));
}
