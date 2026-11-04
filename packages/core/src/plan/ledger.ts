import { compareMonths, type MonthKey, monthKeyOf, monthKeyOfDate, monthsBetween } from "../dates";
import { type BudgetSnapshot, READY_TO_ASSIGN, type Transaction } from "../schema";

export type MonthAmounts = Map<string, number>;

export type Ledger = {
  firstMonth: MonthKey;
  months: MonthKey[];
  assignedByMonth: Map<MonthKey, MonthAmounts>;
  activityByMonth: Map<MonthKey, MonthAmounts>;
  incomeByMonth: Map<MonthKey, number>;
  uncategorizedByMonth: Map<MonthKey, { count: number; amountMinor: number }>;
  balanceByMonth: Map<MonthKey, Map<string, number>>;
  onBudgetBalanceByMonth: Map<MonthKey, number>;
  currentAccountBalances: Map<string, number>;
};

/**
 * One pass over the document, indexed by month. Balance uses split parents; activity and
 * income use split children. Off-budget accounts contribute to net worth only.
 */
export function buildLedger(
  snapshot: BudgetSnapshot,
  throughMonth: MonthKey,
  fallbackMonth: MonthKey = monthKeyOfDate(new Date()),
): Ledger {
  const accountById = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const parentIds = new Set(
    snapshot.transactions
      .map((transaction) => transaction.parentId)
      .filter((id): id is string => id !== null),
  );

  const dataMonths = new Set<MonthKey>();
  for (const transaction of snapshot.transactions) dataMonths.add(monthKeyOf(transaction.date));
  for (const budget of snapshot.monthlyBudgets) dataMonths.add(budget.month);
  for (const target of snapshot.targets) dataMonths.add(target.startsOn);
  dataMonths.add(fallbackMonth);

  let firstMonth = throughMonth;
  for (const month of dataMonths) {
    if (compareMonths(month, firstMonth) < 0) firstMonth = month;
  }
  if (compareMonths(fallbackMonth, firstMonth) < 0) firstMonth = fallbackMonth;
  // The requested month is the upper bound; data beyond it belongs to a later view.
  const months = monthsBetween(firstMonth, throughMonth);

  const assignedByMonth = new Map<MonthKey, MonthAmounts>();
  for (const budget of snapshot.monthlyBudgets) {
    const amounts = assignedByMonth.get(budget.month) ?? new Map<string, number>();
    amounts.set(budget.categoryId, budget.assignedMinor);
    assignedByMonth.set(budget.month, amounts);
  }

  const activityByMonth = new Map<MonthKey, MonthAmounts>();
  const incomeByMonth = new Map<MonthKey, number>();
  const uncategorizedByMonth = new Map<MonthKey, { count: number; amountMinor: number }>();

  const add = (
    map: Map<MonthKey, MonthAmounts>,
    month: MonthKey,
    categoryId: string,
    amount: number,
  ): void => {
    const amounts = map.get(month) ?? new Map<string, number>();
    amounts.set(categoryId, (amounts.get(categoryId) ?? 0) + amount);
    map.set(month, amounts);
  };

  for (const transaction of snapshot.transactions) {
    const account = accountById.get(transaction.accountId);
    if (!account?.onBudget) continue;
    if (transaction.parentId === null && parentIds.has(transaction.id)) continue;

    const month = monthKeyOf(transaction.date);
    if (transaction.categoryId === READY_TO_ASSIGN) {
      incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + transaction.amountMinor);
    } else if (transaction.categoryId === null) {
      const current = uncategorizedByMonth.get(month) ?? { count: 0, amountMinor: 0 };
      uncategorizedByMonth.set(month, {
        count: current.count + 1,
        amountMinor: current.amountMinor + transaction.amountMinor,
      });
    } else {
      add(activityByMonth, month, transaction.categoryId, transaction.amountMinor);
    }
  }

  const transactionsByMonth = new Map<MonthKey, Transaction[]>();
  for (const transaction of snapshot.transactions) {
    const month = monthKeyOf(transaction.date);
    const list = transactionsByMonth.get(month) ?? [];
    list.push(transaction);
    transactionsByMonth.set(month, list);
  }

  const balanceByMonth = new Map<MonthKey, Map<string, number>>();
  const onBudgetBalanceByMonth = new Map<MonthKey, number>();
  const running = new Map<string, number>();
  for (const account of snapshot.accounts) running.set(account.id, 0);

  for (const month of months) {
    for (const transaction of transactionsByMonth.get(month) ?? []) {
      if (transaction.parentId !== null) continue;
      if (!accountById.has(transaction.accountId)) continue;
      running.set(
        transaction.accountId,
        (running.get(transaction.accountId) ?? 0) + transaction.amountMinor,
      );
    }
    const copy = new Map(running);
    balanceByMonth.set(month, copy);
    let onBudget = 0;
    for (const [accountId, balance] of copy) {
      if (accountById.get(accountId)?.onBudget) onBudget += balance;
    }
    onBudgetBalanceByMonth.set(month, onBudget);
  }

  return {
    firstMonth,
    months,
    assignedByMonth,
    activityByMonth,
    incomeByMonth,
    uncategorizedByMonth,
    balanceByMonth,
    onBudgetBalanceByMonth,
    currentAccountBalances: new Map(running),
  };
}
