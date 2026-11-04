import type { LoroDoc } from "loro-crdt";

import { createId } from "../ids";
import { type Payee, payeeSchema, transactionSchema } from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";

export class PayeeError extends Error {
  constructor(
    readonly code: "not-found" | "in-use",
    message: string,
  ) {
    super(message);
    this.name = "PayeeError";
  }
}

export function listPayees(doc: LoroDoc): Payee[] {
  return listRecords(doc, ROOTS.payees, payeeSchema).sort((left, right) =>
    left.archivedAt === right.archivedAt
      ? left.name.localeCompare(right.name)
      : left.archivedAt
        ? 1
        : -1,
  );
}

export function getPayee(doc: LoroDoc, id: string): Payee | undefined {
  return getRecord(doc, ROOTS.payees, id, payeeSchema);
}

function requirePayee(doc: LoroDoc, id: string): Payee {
  const payee = getPayee(doc, id);
  if (!payee) throw new PayeeError("not-found", `Payee ${id} does not exist`);
  return payee;
}

function findPayeeByName(doc: LoroDoc, name: string): Payee | undefined {
  const needle = name.trim().toLowerCase();
  return listPayees(doc).find((payee) => payee.name.toLowerCase() === needle);
}

export function createPayee(
  doc: LoroDoc,
  input: { name: string; defaultCategoryId?: string | null },
  now: Date = new Date(),
): Payee {
  const payee = payeeSchema.parse({
    id: createId("payee"),
    name: input.name.trim(),
    defaultCategoryId: input.defaultCategoryId ?? null,
    lastCategoryId: null,
    learn: true,
    archivedAt: null,
    createdAt: now.toISOString(),
  });
  insertRecord(doc, ROOTS.payees, payeeSchema, payee);
  return payee;
}

export function ensurePayeeByName(doc: LoroDoc, name: string, now: Date = new Date()): Payee {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new PayeeError("not-found", "A payee needs a name");
  return findPayeeByName(doc, trimmed) ?? createPayee(doc, { name: trimmed }, now);
}

export function updatePayee(
  doc: LoroDoc,
  id: string,
  patch: Partial<
    Pick<Payee, "name" | "defaultCategoryId" | "lastCategoryId" | "learn" | "archivedAt">
  >,
): Payee {
  return updateRecord(doc, ROOTS.payees, id, payeeSchema, patch);
}

export function rememberCategoryForPayee(doc: LoroDoc, payeeId: string, categoryId: string): void {
  const payee = getPayee(doc, payeeId);
  if (!payee || payee.lastCategoryId === categoryId) return;
  updateRecord(doc, ROOTS.payees, payeeId, payeeSchema, { lastCategoryId: categoryId });
}

export function mergePayees(doc: LoroDoc, sourceId: string, targetId: string): void {
  if (sourceId === targetId) return;
  const target = requirePayee(doc, targetId);
  for (const transaction of listRecords(doc, ROOTS.transactions, transactionSchema)) {
    if (transaction.payeeId === sourceId) {
      updateRecord(doc, ROOTS.transactions, transaction.id, transactionSchema, {
        payeeId: target.id,
        payeeName: target.name,
      });
    }
  }
  deleteRecord(doc, ROOTS.payees, sourceId);
}

export function deletePayee(doc: LoroDoc, id: string): void {
  const used = listRecords(doc, ROOTS.transactions, transactionSchema).some(
    (transaction) => transaction.payeeId === id,
  );
  if (used) {
    throw new PayeeError("in-use", "A payee with transactions is archived, not deleted");
  }
  deleteRecord(doc, ROOTS.payees, id);
}
