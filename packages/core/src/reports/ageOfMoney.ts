import { diffDays, endOfMonth, type MonthKey, monthKeyOf } from "../dates";
import { type BudgetSnapshot, READY_TO_ASSIGN } from "../schema";

export type AgeOfMoneyPoint = {
  month: MonthKey;
  days: number | null;
};

export type AgeOfMoneyReport = {
  averageDays: number | null;
  points: AgeOfMoneyPoint[];
  lastOutflows: { date: string; days: number; amountMinor: number }[];
};

type Lot = { date: string; remaining: number };

/**
 * FIFO over income to Ready to Assign. Each outflow consumes the oldest dollars first; the
 * age of the money spent is the weighted average age of the lots it consumed.
 */
export function ageOfMoney(
  snapshot: BudgetSnapshot,
  months: readonly MonthKey[],
): AgeOfMoneyReport {
  if (months.length === 0) return { averageDays: null, points: [], lastOutflows: [] };
  const through = endOfMonth(months[months.length - 1] ?? months[0] ?? "");
  const accountById = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const parentIds = new Set(
    snapshot.transactions
      .map((transaction) => transaction.parentId)
      .filter((id): id is string => id !== null),
  );

  const transactions = [...snapshot.transactions]
    .filter((transaction) => transaction.date <= through)
    .sort((left, right) =>
      left.date === right.date
        ? left.createdAt.localeCompare(right.createdAt)
        : left.date.localeCompare(right.date),
    );

  const lots: Lot[] = [];
  let lotIndex = 0;
  const outflows: { date: string; days: number; amountMinor: number }[] = [];

  for (const transaction of transactions) {
    const account = accountById.get(transaction.accountId);
    if (!account?.onBudget) continue;
    if (transaction.parentId === null && parentIds.has(transaction.id)) continue;

    if (transaction.transferId) {
      const other = transaction.transferAccountId
        ? accountById.get(transaction.transferAccountId)
        : undefined;
      if (other?.onBudget) continue;
    }

    if (transaction.categoryId === READY_TO_ASSIGN) {
      if (transaction.amountMinor > 0) {
        lots.push({ date: transaction.date, remaining: transaction.amountMinor });
      }
      continue;
    }
    if (transaction.amountMinor >= 0) continue;

    let need = -transaction.amountMinor;
    let weighted = 0;
    let consumed = 0;
    while (need > 0 && lotIndex < lots.length) {
      const lot = lots[lotIndex];
      if (!lot) break;
      const take = Math.min(need, lot.remaining);
      weighted += take * diffDays(lot.date, transaction.date);
      lot.remaining -= take;
      need -= take;
      consumed += take;
      if (lot.remaining === 0) lotIndex += 1;
    }

    const days = consumed > 0 ? weighted / consumed : 0;
    outflows.push({ date: transaction.date, days, amountMinor: -transaction.amountMinor });
  }

  const byMonth = new Map<MonthKey, { weighted: number; amount: number }>();
  for (const outflow of outflows) {
    const month = monthKeyOf(outflow.date);
    const bucket = byMonth.get(month) ?? { weighted: 0, amount: 0 };
    bucket.weighted += outflow.days * outflow.amountMinor;
    bucket.amount += outflow.amountMinor;
    byMonth.set(month, bucket);
  }

  const points: AgeOfMoneyPoint[] = months.map((month) => {
    const bucket = byMonth.get(month);
    if (!bucket || bucket.amount === 0) return { month, days: null };
    return { month, days: Math.round(bucket.weighted / bucket.amount) };
  });

  const last = outflows.slice(-10);
  const total = last.reduce((sum, outflow) => sum + outflow.amountMinor, 0);
  const averageDays =
    total === 0
      ? null
      : Math.round(
          last.reduce((sum, outflow) => sum + outflow.days * outflow.amountMinor, 0) / total,
        );

  return { averageDays, points, lastOutflows: last };
}
