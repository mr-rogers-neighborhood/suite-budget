import type { LoroDoc } from "loro-crdt";

import type { MonthKey } from "../dates";
import { type MonthlyBudget, monthlyBudgetSchema } from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getByKey, listRecords, putRecord } from "./records";

function keyOf(month: MonthKey, categoryId: string): string {
  return `${month}:${categoryId}`;
}

export function listMonthlyBudgets(doc: LoroDoc): MonthlyBudget[] {
  return listRecords(doc, ROOTS.monthlyBudgets, monthlyBudgetSchema).sort((left, right) =>
    left.month.localeCompare(right.month),
  );
}

export function assignedFor(doc: LoroDoc, month: MonthKey, categoryId: string): number {
  return (
    getByKey(doc, ROOTS.monthlyBudgets, keyOf(month, categoryId), monthlyBudgetSchema)
      ?.assignedMinor ?? 0
  );
}

export function assignedByCategory(doc: LoroDoc, month: MonthKey): Map<string, number> {
  const values = new Map<string, number>();
  for (const record of listRecords(doc, ROOTS.monthlyBudgets, monthlyBudgetSchema)) {
    if (record.month === month) values.set(record.categoryId, record.assignedMinor);
  }
  return values;
}

export function setAssigned(
  doc: LoroDoc,
  month: MonthKey,
  categoryId: string,
  amountMinor: number,
  now: Date = new Date(),
): void {
  if (!Number.isInteger(amountMinor)) throw new Error("Assigned amounts are integer minor units");
  if (amountMinor === 0) {
    deleteRecord(doc, ROOTS.monthlyBudgets, keyOf(month, categoryId));
    return;
  }
  putRecord(
    doc,
    ROOTS.monthlyBudgets,
    keyOf(month, categoryId),
    monthlyBudgetSchema,
    monthlyBudgetSchema.parse({
      month,
      categoryId,
      assignedMinor: amountMinor,
      updatedAt: now.toISOString(),
    }),
  );
}

export function applyAssignments(
  doc: LoroDoc,
  month: MonthKey,
  deltas: ReadonlyMap<string, number>,
  now: Date = new Date(),
): void {
  if (deltas.size === 0) return;
  const current = assignedByCategory(doc, month);
  for (const [categoryId, delta] of deltas) {
    if (delta === 0) continue;
    setAssigned(doc, month, categoryId, (current.get(categoryId) ?? 0) + delta, now);
  }
}

export function copyAssignments(
  doc: LoroDoc,
  from: MonthKey,
  to: MonthKey,
  now: Date = new Date(),
): void {
  if (from === to) return;
  const source = assignedByCategory(doc, from);
  const target = assignedByCategory(doc, to);
  for (const categoryId of new Set([...source.keys(), ...target.keys()])) {
    setAssigned(doc, to, categoryId, source.get(categoryId) ?? 0, now);
  }
}
