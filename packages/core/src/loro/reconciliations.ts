import type { LoroDoc } from "loro-crdt";

import type { DateKey } from "../dates";
import { createId } from "../ids";
import {
  READY_TO_ASSIGN,
  type Reconciliation,
  reconciliationSchema,
  type Transaction,
  transactionSchema,
} from "../schema";
import { requireAccount } from "./accounts";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords } from "./records";
import { createTransaction, setReconciledThrough, unlockAccount } from "./transactions";

export class ReconciliationError extends Error {
  constructor(
    readonly code: "not-found" | "locked",
    message: string,
  ) {
    super(message);
    this.name = "ReconciliationError";
  }
}

export function listReconciliations(doc: LoroDoc): Reconciliation[] {
  return listRecords(doc, ROOTS.reconciliations, reconciliationSchema).sort((left, right) =>
    right.statementDate.localeCompare(left.statementDate),
  );
}

/** The sum of cleared and reconciled rows on an account through a date. */
export function clearedBalance(doc: LoroDoc, accountId: string, through: DateKey): number {
  let balance = 0;
  for (const transaction of listRecords(doc, ROOTS.transactions, transactionSchema)) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.parentId !== null) continue;
    if (transaction.date > through) continue;
    if (transaction.cleared === "uncleared") continue;
    balance += transaction.amountMinor;
  }
  return balance;
}

export function reconcileAccount(
  doc: LoroDoc,
  input: { accountId: string; statementDate: DateKey; statementBalanceMinor: number },
  now: Date = new Date(),
): { reconciliation: Reconciliation; adjustment: Transaction | null } {
  const account = requireAccount(doc, input.accountId);
  const cleared = clearedBalance(doc, input.accountId, input.statementDate);
  const difference = input.statementBalanceMinor - cleared;

  let adjustment: Transaction | null = null;
  if (difference !== 0) {
    adjustment = createTransaction(
      doc,
      {
        accountId: account.id,
        date: input.statementDate,
        amountMinor: difference,
        payeeName: "Reconciliation Balance Adjustment",
        categoryId: account.onBudget ? READY_TO_ASSIGN : null,
        memo: "Balance adjustment from reconciliation",
        cleared: "cleared",
      },
      now,
    );
  }

  setReconciledThrough(doc, account.id, input.statementDate, now);
  const reconciliation = reconciliationSchema.parse({
    id: createId("recon"),
    accountId: account.id,
    statementDate: input.statementDate,
    statementBalanceMinor: input.statementBalanceMinor,
    adjustmentTransactionId: adjustment?.id ?? null,
    createdAt: now.toISOString(),
  });
  insertRecord(doc, ROOTS.reconciliations, reconciliationSchema, reconciliation);
  return { reconciliation, adjustment };
}

export function unlockReconciliation(doc: LoroDoc, id: string, now: Date = new Date()): void {
  const record = getRecord(doc, ROOTS.reconciliations, id, reconciliationSchema);
  if (!record) throw new ReconciliationError("not-found", `Reconciliation ${id} does not exist`);
  unlockAccount(doc, record.accountId, record.statementDate, now);
  deleteRecord(doc, ROOTS.reconciliations, id);
}
