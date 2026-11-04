import { err, ok, type Result } from "neverthrow";

import { addMonths, type MonthKey } from "../dates";
import type { BudgetSnapshot } from "../schema";
import { buildLedger } from "./ledger";
import type { MonthState } from "./monthState";

export type AutoAssignResult = {
  deltas: Map<string, number>;
  totalMinor: number;
  shortfallMinor: number;
};

export type MoneyMove = {
  fromCategoryId: string | "rta";
  toCategoryId: string;
  amountMinor: number;
};

export function underfunded(state: MonthState, readyToAssignMinor: number): AutoAssignResult {
  const deltas = new Map<string, number>();
  let remaining = Math.max(0, readyToAssignMinor);
  let total = 0;
  let shortfall = 0;

  for (const group of state.groups) {
    for (const entry of group.categories) {
      const need = entry.target?.suggestionMinor ?? 0;
      if (need <= 0) continue;
      const take = Math.min(need, remaining);
      if (take > 0) {
        deltas.set(entry.category.id, take);
        remaining -= take;
        total += take;
      }
      if (need > take) shortfall += need - take;
    }
  }
  return { deltas, totalMinor: total, shortfallMinor: shortfall };
}

export function lastMonth(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  state: MonthState,
): AutoAssignResult {
  const source = addMonths(month, -1);
  const ledger = buildLedger(snapshot, month);
  const previous = ledger.assignedByMonth.get(source);
  const current = new Map(
    state.groups.flatMap((group) =>
      group.categories.map((entry) => [entry.category.id, entry.assignedMinor] as const),
    ),
  );
  const deltas = new Map<string, number>();
  let total = 0;
  for (const categoryId of new Set([...current.keys(), ...(previous?.keys() ?? [])])) {
    const target = previous?.get(categoryId) ?? 0;
    const delta = target - (current.get(categoryId) ?? 0);
    if (delta === 0) continue;
    deltas.set(categoryId, delta);
    total += delta;
  }
  return { deltas, totalMinor: total, shortfallMinor: 0 };
}

export function averageSpent(
  snapshot: BudgetSnapshot,
  month: MonthKey,
  state: MonthState,
  window = 3,
): AutoAssignResult {
  const ledger = buildLedger(snapshot, month);
  const months = Array.from({ length: window }, (_, index) => addMonths(month, -(index + 1)));
  const current = new Map(
    state.groups.flatMap((group) =>
      group.categories.map((entry) => [entry.category.id, entry.assignedMinor] as const),
    ),
  );
  const deltas = new Map<string, number>();
  let total = 0;

  for (const [categoryId, assigned] of current) {
    let spent = 0;
    let seen = 0;
    for (const candidate of months) {
      const activity = ledger.activityByMonth.get(candidate)?.get(categoryId);
      if (activity === undefined) continue;
      spent += Math.abs(activity);
      seen += 1;
    }
    if (seen === 0) continue;
    const average = Math.round(spent / seen);
    const delta = average - assigned;
    if (delta === 0) continue;
    deltas.set(categoryId, delta);
    total += delta;
  }
  return { deltas, totalMinor: total, shortfallMinor: 0 };
}

export function coverOverspending(state: MonthState, readyToAssignMinor: number): AutoAssignResult {
  const deltas = new Map<string, number>();
  let remaining = Math.max(0, readyToAssignMinor);
  let total = 0;
  let shortfall = 0;

  for (const group of state.groups) {
    for (const entry of group.categories) {
      if (entry.availableMinor >= 0) continue;
      const need = -entry.availableMinor;
      const take = Math.min(need, remaining);
      if (take > 0) {
        deltas.set(entry.category.id, take);
        remaining -= take;
        total += take;
      }
      if (need > take) shortfall += need - take;
    }
  }
  return { deltas, totalMinor: total, shortfallMinor: shortfall };
}

export function moveMoney(state: MonthState, move: MoneyMove): Result<Map<string, number>, string> {
  if (!Number.isInteger(move.amountMinor) || move.amountMinor <= 0) {
    return err("Move a positive amount");
  }
  if (move.fromCategoryId === move.toCategoryId) return err("Pick two different envelopes");
  const destination = state.groups
    .flatMap((group) => group.categories)
    .find((entry) => entry.category.id === move.toCategoryId);
  if (!destination) return err("The destination category does not exist");

  const deltas = new Map<string, number>();
  if (move.fromCategoryId === "rta") {
    if (state.readyToAssignMinor < move.amountMinor) {
      return err("Ready to Assign does not have that much");
    }
  } else {
    const source = state.groups
      .flatMap((group) => group.categories)
      .find((entry) => entry.category.id === move.fromCategoryId);
    if (!source) return err("The source category does not exist");
    if (source.availableMinor < move.amountMinor) {
      return err("That envelope does not have that much available");
    }
    deltas.set(move.fromCategoryId, -move.amountMinor);
  }
  deltas.set(move.toCategoryId, move.amountMinor);
  return ok(deltas);
}
