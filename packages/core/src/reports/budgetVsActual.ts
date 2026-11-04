import type { MonthKey } from "../dates";
import { type MonthState, monthState } from "../plan/monthState";
import type { BudgetSnapshot } from "../schema";

export type BudgetActualRow = {
  categoryId: string;
  categoryName: string;
  groupName: string;
  assignedMinor: number;
  activityMinor: number;
  availableMinor: number;
};

export function budgetVsActual(snapshot: BudgetSnapshot, month: MonthKey): BudgetActualRow[] {
  const state: MonthState = monthState(snapshot, month);
  return state.groups.flatMap((group) =>
    group.categories.map((entry) => ({
      categoryId: entry.category.id,
      categoryName: entry.category.name,
      groupName: group.group.name,
      assignedMinor: entry.assignedMinor,
      activityMinor: entry.activityMinor,
      availableMinor: entry.availableMinor,
    })),
  );
}
