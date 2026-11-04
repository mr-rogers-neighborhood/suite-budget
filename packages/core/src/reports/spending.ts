import type { MonthKey } from "../dates";
import { buildLedger } from "../plan/ledger";
import type { BudgetSnapshot } from "../schema";

export type SpendingRow = {
  categoryId: string;
  categoryName: string;
  groupId: string;
  groupName: string;
  spentMinor: number;
};

export function spendingByCategory(
  snapshot: BudgetSnapshot,
  months: readonly MonthKey[],
): SpendingRow[] {
  if (months.length === 0) return [];
  const ledger = buildLedger(snapshot, months[months.length - 1] ?? months[0] ?? "");
  const spend = new Map<string, number>();
  for (const month of months) {
    for (const [categoryId, amount] of ledger.activityByMonth.get(month) ?? []) {
      spend.set(categoryId, (spend.get(categoryId) ?? 0) + amount);
    }
  }

  const groupById = new Map(snapshot.categoryGroups.map((group) => [group.id, group]));
  const rows: SpendingRow[] = [];
  for (const category of snapshot.categories) {
    const net = spend.get(category.id) ?? 0;
    if (net >= 0) continue;
    const group = groupById.get(category.groupId);
    rows.push({
      categoryId: category.id,
      categoryName: category.name,
      groupId: category.groupId,
      groupName: group?.name ?? "Ungrouped",
      spentMinor: -net,
    });
  }
  return rows.sort((left, right) => right.spentMinor - left.spentMinor);
}
