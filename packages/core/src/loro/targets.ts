import type { LoroDoc } from "loro-crdt";

import { addMonths, compareMonths, type MonthKey } from "../dates";
import { createId } from "../ids";
import { pickActiveTarget } from "../plan/targets";
import { type Target, type TargetKind, targetSchema } from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, insertRecord, listRecords } from "./records";
export type TargetInput = {
  kind: TargetKind;
  amountMinor: number;
  dueMonth?: MonthKey | null;
  accountId?: string | null;
};

export function listTargets(doc: LoroDoc): Target[] {
  return listRecords(doc, ROOTS.targets, targetSchema).sort((left, right) =>
    compareMonths(left.startsOn, right.startsOn),
  );
}

export function activeTarget(
  doc: LoroDoc,
  categoryId: string,
  month: MonthKey,
): Target | undefined {
  return pickActiveTarget(listTargets(doc), categoryId, month);
}

export function setTarget(
  doc: LoroDoc,
  categoryId: string,
  input: TargetInput,
  month: MonthKey,
  now: Date = new Date(),
): Target {
  const timestamp = now.toISOString();
  const existing = activeTarget(doc, categoryId, month);
  if (existing) {
    if (compareMonths(existing.startsOn, month) >= 0) {
      deleteRecord(doc, ROOTS.targets, existing.id);
    } else {
      const previousMonth = addMonths(month, -1);
      const closed = targetSchema.parse({
        ...existing,
        endsOn: previousMonth,
        updatedAt: timestamp,
      });
      insertRecord(doc, ROOTS.targets, targetSchema, closed);
    }
  }
  const target = targetSchema.parse({
    id: createId("tgt"),
    categoryId,
    kind: input.kind,
    amountMinor: input.amountMinor,
    dueMonth: input.dueMonth ?? null,
    accountId: input.accountId ?? null,
    startsOn: month,
    endsOn: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.targets, targetSchema, target);
  return target;
}

export function clearTarget(
  doc: LoroDoc,
  categoryId: string,
  month: MonthKey,
  now: Date = new Date(),
): void {
  const existing = activeTarget(doc, categoryId, month);
  if (!existing) return;
  if (compareMonths(existing.startsOn, month) >= 0) {
    deleteRecord(doc, ROOTS.targets, existing.id);
    return;
  }
  insertRecord(
    doc,
    ROOTS.targets,
    targetSchema,
    targetSchema.parse({
      ...existing,
      endsOn: addMonths(month, -1),
      updatedAt: now.toISOString(),
    }),
  );
}
