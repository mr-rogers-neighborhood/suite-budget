import type { LoroDoc } from "loro-crdt";

import { type DateKey, todayKey } from "../dates";
import { createId } from "../ids";
import {
  type Account,
  type AccountType,
  accountSchema,
  type LoanTerms,
  READY_TO_ASSIGN,
  transactionSchema,
} from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";

export type NewAccountInput = {
  name: string;
  type: AccountType;
  onBudget?: boolean | undefined;
  note?: string | undefined;
  creditLimitMinor?: number | null | undefined;
  loan?: LoanTerms | undefined;
  startingBalanceMinor?: number | undefined;
  startingDate?: DateKey | undefined;
};

export type AccountPatch = Partial<Pick<Account, "name" | "note" | "creditLimitMinor" | "loan">>;

const TYPE_ORDER: Record<AccountType, number> = {
  checking: 0,
  savings: 1,
  cash: 2,
  credit: 3,
  loan: 4,
};

export class AccountError extends Error {
  constructor(
    readonly code: "not-found" | "not-empty" | "immutable" | "duplicate",
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export function listAccounts(doc: LoroDoc): Account[] {
  return listRecords(doc, ROOTS.accounts, accountSchema).sort((left, right) => {
    if (left.closedAt !== right.closedAt) return left.closedAt ? 1 : -1;
    if (left.type !== right.type) return TYPE_ORDER[left.type] - TYPE_ORDER[right.type];
    return left.name.localeCompare(right.name);
  });
}

export function getAccount(doc: LoroDoc, id: string): Account | undefined {
  return getRecord(doc, ROOTS.accounts, id, accountSchema);
}

export function requireAccount(doc: LoroDoc, id: string): Account {
  const account = getAccount(doc, id);
  if (!account) throw new AccountError("not-found", `Account ${id} does not exist`);
  return account;
}

export function createAccount(
  doc: LoroDoc,
  input: NewAccountInput,
  now: Date = new Date(),
): Account {
  const timestamp = now.toISOString();
  const account = accountSchema.parse({
    id: createId("acct"),
    name: input.name.trim(),
    type: input.type,
    onBudget: input.onBudget ?? input.type !== "loan",
    note: input.note ?? "",
    creditLimitMinor: input.creditLimitMinor ?? null,
    loan: input.loan ?? null,
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.accounts, accountSchema, account);

  const startingBalance = input.startingBalanceMinor ?? 0;
  if (startingBalance !== 0) {
    insertRecord(
      doc,
      ROOTS.transactions,
      transactionSchema,
      transactionSchema.parse({
        id: createId("txn"),
        accountId: account.id,
        date: input.startingDate ?? todayKey(now),
        payeeName: "Starting Balance",
        categoryId: account.onBudget ? READY_TO_ASSIGN : null,
        amountMinor: startingBalance,
        memo: "",
        cleared: "cleared",
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  }
  return account;
}

export function updateAccount(
  doc: LoroDoc,
  id: string,
  patch: AccountPatch,
  now: Date = new Date(),
): Account {
  return updateRecord(doc, ROOTS.accounts, id, accountSchema, patch, {
    key: "updatedAt",
    value: now.toISOString(),
  });
}

export function closeAccount(doc: LoroDoc, id: string, now: Date = new Date()): Account {
  const account = requireAccount(doc, id);
  if (account.closedAt) return account;
  if (account.onBudget) {
    const balance = accountBalance(doc, id);
    if (balance !== 0) {
      throw new AccountError(
        "not-empty",
        "Move the balance to another account before closing an on-budget account",
      );
    }
  }
  return updateRecord(
    doc,
    ROOTS.accounts,
    id,
    accountSchema,
    { closedAt: now.toISOString() },
    { key: "updatedAt", value: now.toISOString() },
  );
}

export function reopenAccount(doc: LoroDoc, id: string, now: Date = new Date()): Account {
  return updateRecord(
    doc,
    ROOTS.accounts,
    id,
    accountSchema,
    { closedAt: null },
    { key: "updatedAt", value: now.toISOString() },
  );
}

export function deleteAccount(doc: LoroDoc, id: string): void {
  const transactions = listRecords(doc, ROOTS.transactions, transactionSchema).filter(
    (transaction) => transaction.accountId === id,
  );
  if (transactions.length > 0) {
    throw new AccountError("not-empty", "An account with transactions can only be closed");
  }
  deleteRecord(doc, ROOTS.accounts, id);
}

/** Sums the account's transactions. Split children are folded into their parent. */
export function accountBalance(doc: LoroDoc, accountId: string): number {
  let balance = 0;
  for (const transaction of listRecords(doc, ROOTS.transactions, transactionSchema)) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.parentId !== null) continue;
    balance += transaction.amountMinor;
  }
  return balance;
}
