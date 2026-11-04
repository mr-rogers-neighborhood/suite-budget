import type { MonthKey } from "../dates";
import type { BudgetSnapshot, Category, CategoryGroup } from "../schema";
import { buildLedger } from "./ledger";
import { pickActiveTarget, type TargetStatus, targetStatus } from "./targets";

export type CategoryMonthState = {
  category: Category;
  assignedMinor: number;
  activityMinor: number;
  availableMinor: number;
  target: TargetStatus | null;
};

export type GroupMonthState = {
  group: CategoryGroup;
  categories: CategoryMonthState[];
  assignedMinor: number;
  activityMinor: number;
  availableMinor: number;
};

export type MonthState = {
  month: MonthKey;
  firstMonth: MonthKey;
  readyToAssignMinor: number;
  onBudgetBalanceMinor: number;
  assignedMinor: number;
  activityMinor: number;
  availableMinor: number;
  overspentMinor: number;
  uncategorized: { count: number; amountMinor: number };
  groups: GroupMonthState[];
  targetCount: number;
  fundedTargetCount: number;
};

const UNGROUPED: CategoryGroup = {
  id: "ungrouped",
  name: "Ungrouped",
  order: 9999,
  hidden: false,
  createdAt: new Date(0).toISOString(),
};

export function monthState(snapshot: BudgetSnapshot, month: MonthKey): MonthState {
  const ledger = buildLedger(snapshot, month);
  const available = new Map<string, number>();
  for (const category of snapshot.categories) available.set(category.id, 0);

  for (const current of ledger.months) {
    const assigned = ledger.assignedByMonth.get(current);
    const activity = ledger.activityByMonth.get(current);
    for (const category of snapshot.categories) {
      const carry = Math.max(0, available.get(category.id) ?? 0);
      available.set(
        category.id,
        carry + (assigned?.get(category.id) ?? 0) + (activity?.get(category.id) ?? 0),
      );
    }
  }

  const groupById = new Map<string, CategoryGroup>();
  for (const group of snapshot.categoryGroups) groupById.set(group.id, group);
  const accountById = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const balances = ledger.balanceByMonth.get(month);

  const groupsById = new Map<string, GroupMonthState>();
  const allCategories: CategoryMonthState[] = [];
  let assignedTotal = 0;
  let activityTotal = 0;
  let availableTotal = 0;
  let overspent = 0;
  let targetCount = 0;
  let fundedTargetCount = 0;

  for (const category of snapshot.categories) {
    const assignedMinor = ledger.assignedByMonth.get(month)?.get(category.id) ?? 0;
    const activityMinor = ledger.activityByMonth.get(month)?.get(category.id) ?? 0;
    const availableMinor = available.get(category.id) ?? 0;
    const target = pickActiveTarget(snapshot.targets, category.id, month);
    let status: TargetStatus | null = null;
    if (target) {
      const linkedAccount = target.accountId ? accountById.get(target.accountId) : undefined;
      const linkedBalance = target.accountId ? (balances?.get(target.accountId) ?? null) : null;
      status = targetStatus(
        target,
        availableMinor,
        month,
        linkedBalance,
        linkedAccount?.loan?.originalBalanceMinor ?? null,
      );
      targetCount += 1;
      if (status.funded) fundedTargetCount += 1;
    }

    const entry: CategoryMonthState = {
      category,
      assignedMinor,
      activityMinor,
      availableMinor,
      target: status,
    };
    allCategories.push(entry);
    assignedTotal += assignedMinor;
    activityTotal += activityMinor;
    availableTotal += availableMinor;
    if (availableMinor < 0) overspent += availableMinor;

    const groupId = groupById.has(category.groupId) ? category.groupId : UNGROUPED.id;
    const group = groupById.get(groupId) ?? UNGROUPED;
    const bucket = groupsById.get(groupId) ?? {
      group,
      categories: [],
      assignedMinor: 0,
      activityMinor: 0,
      availableMinor: 0,
    };
    bucket.categories.push(entry);
    bucket.assignedMinor += assignedMinor;
    bucket.activityMinor += activityMinor;
    bucket.availableMinor += availableMinor;
    groupsById.set(groupId, bucket);
  }

  for (const bucket of groupsById.values()) {
    bucket.categories.sort(
      (left, right) =>
        left.category.order - right.category.order ||
        left.category.name.localeCompare(right.category.name),
    );
  }

  const groups = [...groupsById.values()].sort(
    (left, right) =>
      left.group.order - right.group.order || left.group.name.localeCompare(right.group.name),
  );

  const onBudgetBalanceMinor = ledger.onBudgetBalanceByMonth.get(month) ?? 0;
  return {
    month,
    firstMonth: ledger.firstMonth,
    readyToAssignMinor: onBudgetBalanceMinor - availableTotal,
    onBudgetBalanceMinor,
    assignedMinor: assignedTotal,
    activityMinor: activityTotal,
    availableMinor: availableTotal,
    overspentMinor: overspent,
    uncategorized: ledger.uncategorizedByMonth.get(month) ?? { count: 0, amountMinor: 0 },
    groups,
    targetCount,
    fundedTargetCount,
  };
}

export function categoriesInOrder(snapshot: BudgetSnapshot): Category[] {
  const groupOrder = new Map(snapshot.categoryGroups.map((group) => [group.id, group.order]));
  return [...snapshot.categories].sort((left, right) => {
    const groupDelta =
      (groupOrder.get(left.groupId) ?? 9999) - (groupOrder.get(right.groupId) ?? 9999);
    return groupDelta || left.order - right.order || left.name.localeCompare(right.name);
  });
}
