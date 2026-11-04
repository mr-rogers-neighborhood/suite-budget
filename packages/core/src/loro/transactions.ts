import type { LoroDoc } from "loro-crdt";

import type { DateKey } from "../dates";
import { createId } from "../ids";
import {
  type Account,
  type ClearedStatus,
  type ImportedMeta,
  READY_TO_ASSIGN,
  type Transaction,
  type TransactionFlag,
  transactionSchema,
} from "../schema";
import { ROOTS } from "./constants";
import { ensurePayeeByName, getPayee, rememberCategoryForPayee } from "./payees";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";

export type NewTransactionInput = {
  accountId: string;
  date: DateKey;
  amountMinor: number;
  payeeId?: string | null;
  payeeName?: string;
  categoryId?: string | null;
  memo?: string;
  cleared?: ClearedStatus;
  flag?: TransactionFlag | null;
  scheduledId?: string | null;
  imported?: ImportedMeta;
};

export type TransactionPatch = Partial<
  Omit<Transaction, "id" | "createdAt" | "updatedAt" | "parentId" | "transferId">
>;

export type NewTransferInput = {
  fromAccount: Account;
  toAccount: Account;
  date: DateKey;
  amountMinor: number;
  categoryId?: string | null;
  memo?: string;
  cleared?: ClearedStatus;
};

export type SplitInput = {
  categoryId: string | null;
  amountMinor: number;
  memo?: string;
};

export type NewSplitInput = {
  accountId: string;
  date: DateKey;
  payeeId?: string | null;
  payeeName?: string;
  memo?: string;
  cleared?: ClearedStatus;
  flag?: TransactionFlag | null;
  splits: SplitInput[];
};

export class TransactionError extends Error {
  constructor(
    readonly code:
      | "not-found"
      | "split-parent"
      | "split-child"
      | "transfer"
      | "reconciled"
      | "split-total"
      | "zero",
    message: string,
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

export function listTransactions(doc: LoroDoc, accountId?: string): Transaction[] {
  return listRecords(doc, ROOTS.transactions, transactionSchema)
    .filter((transaction) => accountId === undefined || transaction.accountId === accountId)
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date);
      return left.createdAt.localeCompare(right.createdAt);
    });
}

export function getTransaction(doc: LoroDoc, id: string): Transaction | undefined {
  return getRecord(doc, ROOTS.transactions, id, transactionSchema);
}

function requireTransaction(doc: LoroDoc, id: string): Transaction {
  const transaction = getTransaction(doc, id);
  if (!transaction) throw new TransactionError("not-found", `Transaction ${id} does not exist`);
  return transaction;
}

export function createTransaction(
  doc: LoroDoc,
  input: NewTransactionInput,
  now: Date = new Date(),
): Transaction {
  const timestamp = now.toISOString();
  let payeeId = input.payeeId ?? null;
  let payeeName = input.payeeName?.trim() ?? "";
  if (payeeId) {
    const payee = getPayee(doc, payeeId);
    if (payee && payeeName.length === 0) payeeName = payee.name;
  } else if (payeeName.length > 0) {
    payeeId = ensurePayeeByName(doc, payeeName, now).id;
  }

  const transaction = transactionSchema.parse({
    id: createId("txn"),
    accountId: input.accountId,
    date: input.date,
    payeeId,
    payeeName,
    categoryId: input.categoryId ?? null,
    amountMinor: input.amountMinor,
    memo: input.memo ?? "",
    cleared: input.cleared ?? "uncleared",
    flag: input.flag ?? null,
    transferId: null,
    transferAccountId: null,
    parentId: null,
    scheduledId: input.scheduledId ?? null,
    imported: input.imported ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.transactions, transactionSchema, transaction);
  if (payeeId && transaction.categoryId && transaction.categoryId !== READY_TO_ASSIGN) {
    rememberCategoryForPayee(doc, payeeId, transaction.categoryId);
  }
  return transaction;
}

export function updateTransaction(
  doc: LoroDoc,
  id: string,
  patch: TransactionPatch,
  now: Date = new Date(),
): Transaction {
  const current = requireTransaction(doc, id);
  if (current.cleared === "reconciled") {
    throw new TransactionError("reconciled", "Unlock the reconciliation before editing this row");
  }
  if (patch.accountId !== undefined && patch.accountId !== current.accountId) {
    if (current.transferId || current.parentId || hasChildren(doc, id)) {
      throw new TransactionError(
        "transfer",
        "Move a transfer or split by deleting and entering it again",
      );
    }
  }
  if (current.parentId === null && hasChildren(doc, id) && patch.amountMinor !== undefined) {
    throw new TransactionError(
      "split-parent",
      "Change a split by replacing its splits, not its total",
    );
  }
  if (patch.amountMinor === 0) throw new TransactionError("zero", "A transaction cannot be zero");

  const next = updateRecord(doc, ROOTS.transactions, id, transactionSchema, patch, {
    key: "updatedAt",
    value: now.toISOString(),
  });

  if (current.transferId) {
    const pair = listTransactions(doc).find(
      (transaction) =>
        transaction.transferId === current.transferId && transaction.id !== current.id,
    );
    if (pair) {
      const pairPatch: Partial<Transaction> = { updatedAt: next.updatedAt };
      if (patch.date !== undefined) pairPatch.date = next.date;
      if (patch.amountMinor !== undefined) pairPatch.amountMinor = -next.amountMinor;
      if (patch.cleared !== undefined) pairPatch.cleared = next.cleared;
      updateRecord(doc, ROOTS.transactions, pair.id, transactionSchema, pairPatch);
    }
  }

  if (current.parentId === null && hasChildren(doc, id)) {
    for (const child of childrenOf(doc, id)) {
      const childPatch: Partial<Transaction> = { updatedAt: next.updatedAt };
      if (patch.date !== undefined) childPatch.date = next.date;
      if (patch.payeeId !== undefined) childPatch.payeeId = next.payeeId;
      if (patch.payeeName !== undefined) childPatch.payeeName = next.payeeName;
      if (patch.cleared !== undefined) childPatch.cleared = next.cleared;
      updateRecord(doc, ROOTS.transactions, child.id, transactionSchema, childPatch);
    }
  }

  if (current.parentId !== null && patch.amountMinor !== undefined) {
    recomputeParentAmount(doc, current.parentId, now);
  }

  if (next.payeeId && next.categoryId && next.categoryId !== READY_TO_ASSIGN) {
    rememberCategoryForPayee(doc, next.payeeId, next.categoryId);
  }
  return next;
}

export function deleteTransaction(doc: LoroDoc, id: string): void {
  const current = requireTransaction(doc, id);
  if (current.cleared === "reconciled") {
    throw new TransactionError("reconciled", "Unlock the reconciliation before deleting this row");
  }

  if (current.transferId) {
    for (const transaction of listTransactions(doc)) {
      if (transaction.transferId === current.transferId) {
        deleteRecord(doc, ROOTS.transactions, transaction.id);
      }
    }
    return;
  }

  const children = childrenOf(doc, id);
  for (const child of children) deleteRecord(doc, ROOTS.transactions, child.id);
  deleteRecord(doc, ROOTS.transactions, id);

  if (current.parentId) {
    const siblings = childrenOf(doc, current.parentId);
    if (siblings.length === 0) {
      deleteRecord(doc, ROOTS.transactions, current.parentId);
    } else {
      recomputeParentAmount(doc, current.parentId);
    }
  }
}

export function createTransfer(
  doc: LoroDoc,
  input: NewTransferInput,
  now: Date = new Date(),
): [Transaction, Transaction] {
  if (input.fromAccount.id === input.toAccount.id) {
    throw new TransactionError("transfer", "A transfer needs two different accounts");
  }
  if (input.amountMinor <= 0) {
    throw new TransactionError("transfer", "A transfer amount must be positive");
  }
  const bothOnBudget = input.fromAccount.onBudget && input.toAccount.onBudget;
  const neitherOnBudget = !input.fromAccount.onBudget && !input.toAccount.onBudget;
  let fromCategory: string | null = null;
  let toCategory: string | null = null;
  if (!bothOnBudget && !neitherOnBudget) {
    if (!input.categoryId) {
      throw new TransactionError("transfer", "A transfer out of the budget needs a category");
    }
    if (input.fromAccount.onBudget) fromCategory = input.categoryId;
    else toCategory = input.categoryId;
  }

  const transferId = createId("transfer");
  const timestamp = now.toISOString();
  const from = transactionSchema.parse({
    id: createId("txn"),
    accountId: input.fromAccount.id,
    date: input.date,
    payeeName: input.toAccount.name,
    categoryId: fromCategory,
    amountMinor: -input.amountMinor,
    memo: input.memo ?? "",
    cleared: input.cleared ?? "uncleared",
    transferId,
    transferAccountId: input.toAccount.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const to = transactionSchema.parse({
    id: createId("txn"),
    accountId: input.toAccount.id,
    date: input.date,
    payeeName: input.fromAccount.name,
    categoryId: toCategory,
    amountMinor: input.amountMinor,
    memo: input.memo ?? "",
    cleared: input.cleared ?? "uncleared",
    transferId,
    transferAccountId: input.fromAccount.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.transactions, transactionSchema, from);
  insertRecord(doc, ROOTS.transactions, transactionSchema, to);
  return [from, to];
}

export function createSplit(
  doc: LoroDoc,
  input: NewSplitInput,
  now: Date = new Date(),
): Transaction {
  if (input.splits.length < 2) {
    throw new TransactionError("split-total", "A split needs at least two lines");
  }
  const total = input.splits.reduce((sum, split) => sum + split.amountMinor, 0);
  if (total === 0) throw new TransactionError("split-total", "A split cannot total zero");
  if (input.splits.some((split) => split.amountMinor === 0)) {
    throw new TransactionError("zero", "A split line cannot be zero");
  }

  const timestamp = now.toISOString();
  let payeeId = input.payeeId ?? null;
  let payeeName = input.payeeName?.trim() ?? "";
  if (payeeId) {
    const payee = getPayee(doc, payeeId);
    if (payee && payeeName.length === 0) payeeName = payee.name;
  } else if (payeeName.length > 0) {
    payeeId = ensurePayeeByName(doc, payeeName, now).id;
  }

  const parent = transactionSchema.parse({
    id: createId("txn"),
    accountId: input.accountId,
    date: input.date,
    payeeId,
    payeeName,
    categoryId: null,
    amountMinor: total,
    memo: input.memo ?? "",
    cleared: input.cleared ?? "uncleared",
    flag: input.flag ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.transactions, transactionSchema, parent);

  for (const split of input.splits) {
    const child = transactionSchema.parse({
      id: createId("txn"),
      accountId: input.accountId,
      date: input.date,
      payeeId,
      payeeName,
      categoryId: split.categoryId,
      amountMinor: split.amountMinor,
      memo: split.memo ?? "",
      cleared: parent.cleared,
      flag: parent.flag,
      parentId: parent.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    insertRecord(doc, ROOTS.transactions, transactionSchema, child);
    if (payeeId && child.categoryId && child.categoryId !== READY_TO_ASSIGN) {
      rememberCategoryForPayee(doc, payeeId, child.categoryId);
    }
  }
  return parent;
}

export function replaceSplits(
  doc: LoroDoc,
  parentId: string,
  splits: readonly SplitInput[],
  now: Date = new Date(),
): Transaction {
  const parent = requireTransaction(doc, parentId);
  if (parent.cleared === "reconciled") {
    throw new TransactionError("reconciled", "Unlock the reconciliation before editing this row");
  }
  if (parent.parentId !== null) {
    throw new TransactionError("split-child", "A split line cannot itself be split");
  }
  if (splits.length < 2) throw new TransactionError("split-total", "A split needs two lines");
  const total = splits.reduce((sum, split) => sum + split.amountMinor, 0);
  if (total === 0) throw new TransactionError("split-total", "A split cannot total zero");
  if (splits.some((split) => split.amountMinor === 0)) {
    throw new TransactionError("zero", "A split line cannot be zero");
  }

  for (const child of childrenOf(doc, parentId)) {
    deleteRecord(doc, ROOTS.transactions, child.id);
  }
  const timestamp = now.toISOString();
  for (const split of splits) {
    const child = transactionSchema.parse({
      id: createId("txn"),
      accountId: parent.accountId,
      date: parent.date,
      payeeId: parent.payeeId,
      payeeName: parent.payeeName,
      categoryId: split.categoryId,
      amountMinor: split.amountMinor,
      memo: split.memo ?? "",
      cleared: parent.cleared,
      flag: parent.flag,
      parentId: parent.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    insertRecord(doc, ROOTS.transactions, transactionSchema, child);
    if (parent.payeeId && child.categoryId && child.categoryId !== READY_TO_ASSIGN) {
      rememberCategoryForPayee(doc, parent.payeeId, child.categoryId);
    }
  }
  return updateRecord(doc, ROOTS.transactions, parentId, transactionSchema, {
    amountMinor: total,
    updatedAt: timestamp,
  });
}

export function toggleCleared(doc: LoroDoc, id: string, now: Date = new Date()): Transaction {
  const current = requireTransaction(doc, id);
  if (current.cleared === "reconciled") {
    throw new TransactionError("reconciled", "Unlock the reconciliation before changing this row");
  }
  return updateTransaction(
    doc,
    id,
    { cleared: current.cleared === "cleared" ? "uncleared" : "cleared" },
    now,
  );
}

export function setReconciledThrough(
  doc: LoroDoc,
  accountId: string,
  through: DateKey,
  now: Date = new Date(),
): void {
  for (const transaction of listTransactions(doc, accountId)) {
    if (transaction.date <= through && transaction.cleared !== "uncleared") {
      updateRecord(doc, ROOTS.transactions, transaction.id, transactionSchema, {
        cleared: "reconciled",
        updatedAt: now.toISOString(),
      });
    }
  }
}

export function unlockAccount(
  doc: LoroDoc,
  accountId: string,
  through: DateKey,
  now: Date = new Date(),
): void {
  for (const transaction of listTransactions(doc, accountId)) {
    if (transaction.date <= through && transaction.cleared === "reconciled") {
      updateRecord(doc, ROOTS.transactions, transaction.id, transactionSchema, {
        cleared: "cleared",
        updatedAt: now.toISOString(),
      });
    }
  }
}

function childrenOf(doc: LoroDoc, parentId: string): Transaction[] {
  return listTransactions(doc).filter((transaction) => transaction.parentId === parentId);
}

function hasChildren(doc: LoroDoc, id: string): boolean {
  return listTransactions(doc).some((transaction) => transaction.parentId === id);
}

function recomputeParentAmount(doc: LoroDoc, parentId: string, now: Date = new Date()): void {
  const children = childrenOf(doc, parentId);
  if (children.length === 0) {
    deleteRecord(doc, ROOTS.transactions, parentId);
    return;
  }
  const total = children.reduce((sum, child) => sum + child.amountMinor, 0);
  updateRecord(doc, ROOTS.transactions, parentId, transactionSchema, {
    amountMinor: total,
    updatedAt: now.toISOString(),
  });
}
