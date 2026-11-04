import type { MonthKey } from "../dates";
import { buildLedger } from "../plan/ledger";
import type { BudgetSnapshot } from "../schema";

export type SeriesPoint = {
  month: MonthKey;
  valueMinor: number;
};

export function netWorthSeries(
  snapshot: BudgetSnapshot,
  months: readonly MonthKey[],
  options: { includeOffBudget?: boolean } = {},
): SeriesPoint[] {
  if (months.length === 0) return [];
  const ledger = buildLedger(snapshot, months[months.length - 1] ?? months[0] ?? "");
  const includeOffBudget = options.includeOffBudget ?? true;
  const onBudget = new Set(
    snapshot.accounts.filter((account) => account.onBudget).map((account) => account.id),
  );

  return months.map((month) => {
    const balances = ledger.balanceByMonth.get(month);
    let total = 0;
    for (const [accountId, balance] of balances ?? []) {
      if (!includeOffBudget && !onBudget.has(accountId)) continue;
      total += balance;
    }
    return { month, valueMinor: total };
  });
}

export function accountBalanceSeries(
  snapshot: BudgetSnapshot,
  accountId: string,
  months: readonly MonthKey[],
): SeriesPoint[] {
  if (months.length === 0) return [];
  const ledger = buildLedger(snapshot, months[months.length - 1] ?? months[0] ?? "");
  return months.map((month) => ({
    month,
    valueMinor: ledger.balanceByMonth.get(month)?.get(accountId) ?? 0,
  }));
}
