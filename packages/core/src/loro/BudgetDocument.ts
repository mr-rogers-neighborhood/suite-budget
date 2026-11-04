import { LoroDoc, UndoManager } from "loro-crdt";
import { err, ok, type Result } from "neverthrow";

import type { MonthKey } from "../dates";
import type { StarterTemplateId } from "../ports";
import {
  accountSchema,
  type BudgetSnapshot,
  categoryGroupSchema,
  categorySchema,
  dashboardSchema,
  monthlyBudgetSchema,
  payeeSchema,
  READY_TO_ASSIGN,
  reconciliationSchema,
  ruleSchema,
  type Settings,
  scheduleSchema,
  type Target,
  targetSchema,
  transactionSchema,
  widgetSchema,
} from "../schema";
import {
  type AccountPatch,
  accountBalance,
  closeAccount,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  type NewAccountInput,
  reopenAccount,
  updateAccount,
} from "./accounts";
import {
  createCategory,
  createCategoryGroup,
  deleteCategory,
  deleteCategoryGroup,
  getCategory,
  getCategoryGroup,
  listCategories,
  listCategoryGroups,
  reorderCategories,
  updateCategory,
  updateCategoryGroup,
} from "./categories";
import { ROOTS } from "./constants";
import {
  createWidget,
  deleteWidget,
  ensureDefaultDashboard,
  listDashboards,
  listWidgets,
  moveWidget,
  updateWidget,
} from "./dashboards";
import { initializeMeta, readMeta, writeMeta } from "./meta";
import {
  applyAssignments,
  assignedByCategory,
  assignedFor,
  copyAssignments,
  listMonthlyBudgets,
  setAssigned,
} from "./months";
import { createPayee, deletePayee, getPayee, listPayees, mergePayees, updatePayee } from "./payees";
import {
  clearedBalance,
  listReconciliations,
  reconcileAccount,
  unlockReconciliation,
} from "./reconciliations";
import { insertRecord, putRecord } from "./records";
import {
  createRule,
  deleteRule,
  listRules,
  type NewRuleInput,
  updateRule,
  upsertLearnedCategoryRule,
  upsertLearnedPayeeRule,
} from "./rules";
import {
  createSchedule,
  deleteSchedule,
  enterSchedule,
  listSchedules,
  type NewScheduleInput,
  updateSchedule,
} from "./schedules";
import { ensureSettings, readSettings, updateSettings } from "./settings";
import { readBudgetSnapshot } from "./snapshot";
import { activeTarget, clearTarget, listTargets, setTarget, type TargetInput } from "./targets";
import { applyStarterTemplate as applyTemplate } from "./templates";
import {
  createSplit,
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTransaction,
  listTransactions,
  type NewSplitInput,
  type NewTransactionInput,
  type NewTransferInput,
  replaceSplits,
  type SplitInput,
  type TransactionPatch,
  toggleCleared,
  updateTransaction,
} from "./transactions";

const initialSettings = (options: CreateBudgetOptions): Partial<Settings> => {
  const settings: Partial<Settings> = {};
  if (options.currency) settings.currency = options.currency.toUpperCase();
  if (options.currencyScale !== undefined) settings.currencyScale = options.currencyScale;
  if (options.firstDayOfWeek !== undefined) settings.firstDayOfWeek = options.firstDayOfWeek;
  return settings;
};

export type CreateBudgetOptions = {
  name?: string | undefined;
  currency?: string | undefined;
  currencyScale?: number | undefined;
  firstDayOfWeek?: number | undefined;
  now?: Date | undefined;
};

/**
 * The only writer of a budget. Every mutation validates through Zod before it commits, and
 * every field is written on its own key so concurrent edits merge instead of clobbering a record.
 */
export class BudgetDocument {
  readonly #doc: LoroDoc;
  readonly #undo: UndoManager;
  #depth = 0;

  private constructor(doc: LoroDoc) {
    this.#doc = doc;
    this.#undo = new UndoManager(doc, { mergeInterval: 0, maxUndoSteps: 100 });
    doc.setChangeMergeInterval(-1);
  }

  static create(options: CreateBudgetOptions = {}): BudgetDocument {
    const now = options.now ?? new Date();
    const doc = new LoroDoc();
    ensureSettings(doc, initialSettings(options));
    initializeMetaAndDashboard(doc, now, options.name ?? "Budget");
    doc.commit();
    return new BudgetDocument(doc);
  }

  static fromSnapshot(bytes: Uint8Array): BudgetDocument {
    const doc = LoroDoc.fromSnapshot(bytes);
    // A replica must not reuse the peer id baked into the snapshot, or its first edit collides
    // with the document that produced it.
    doc.setPeerId(randomPeerId());
    return new BudgetDocument(doc);
  }

  /** Builds a fresh document from a plain records export, preserving ids. */
  static fromRecords(records: BudgetSnapshot, now: Date = new Date()): BudgetDocument {
    const doc = new LoroDoc();
    writeMeta(doc, records.meta);
    ensureSettings(doc, records.settings);
    for (const account of records.accounts) {
      insertRecord(doc, ROOTS.accounts, accountSchema, account);
    }
    for (const group of records.categoryGroups) {
      insertRecord(doc, ROOTS.categoryGroups, categoryGroupSchema, group);
    }
    for (const category of records.categories) {
      insertRecord(doc, ROOTS.categories, categorySchema, category);
    }
    for (const target of records.targets) insertRecord(doc, ROOTS.targets, targetSchema, target);
    for (const budget of records.monthlyBudgets) {
      putRecord(
        doc,
        ROOTS.monthlyBudgets,
        `${budget.month}:${budget.categoryId}`,
        monthlyBudgetSchema,
        budget,
      );
    }
    for (const transaction of records.transactions) {
      insertRecord(doc, ROOTS.transactions, transactionSchema, transaction);
    }
    for (const payee of records.payees) insertRecord(doc, ROOTS.payees, payeeSchema, payee);
    for (const rule of records.rules) insertRecord(doc, ROOTS.rules, ruleSchema, rule);
    for (const schedule of records.schedules) {
      insertRecord(doc, ROOTS.schedules, scheduleSchema, schedule);
    }
    for (const reconciliation of records.reconciliations) {
      insertRecord(doc, ROOTS.reconciliations, reconciliationSchema, reconciliation);
    }
    for (const dashboard of records.dashboards) {
      insertRecord(doc, ROOTS.dashboards, dashboardSchema, dashboard);
    }
    for (const widget of records.widgets) insertRecord(doc, ROOTS.widgets, widgetSchema, widget);
    if (records.dashboards.length === 0) ensureDefaultDashboard(doc, now);
    doc.commit();
    return new BudgetDocument(doc);
  }

  /** Escape hatch for the renderer's undo manager and tests. */
  get loro(): LoroDoc {
    return this.#doc;
  }

  snapshot(): Uint8Array {
    this.#doc.commit();
    return this.#doc.export({ mode: "snapshot" });
  }

  observe(listener: (update: Uint8Array) => void): () => void {
    return this.#doc.subscribeLocalUpdates((bytes) => listener(bytes));
  }

  applyUpdate(update: Uint8Array): void {
    this.#doc.import(update);
  }

  getSnapshot(): BudgetSnapshot {
    return readBudgetSnapshot(this.#doc);
  }

  validate(): Result<BudgetSnapshot, Error> {
    try {
      return ok(this.getSnapshot());
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  undo(): void {
    this.#undo.undo();
  }

  redo(): void {
    this.#undo.redo();
  }

  canUndo(): boolean {
    return this.#undo.canUndo();
  }

  canRedo(): boolean {
    return this.#undo.canRedo();
  }

  // Accounts

  listAccounts() {
    return listAccounts(this.#doc);
  }

  getAccount(id: string) {
    return getAccount(this.#doc, id);
  }

  createAccount(input: NewAccountInput, now?: Date) {
    return this.#mutate(() => createAccount(this.#doc, input, now));
  }

  updateAccount(id: string, patch: AccountPatch, now?: Date) {
    return this.#mutate(() => updateAccount(this.#doc, id, patch, now));
  }

  closeAccount(id: string, now?: Date) {
    return this.#mutate(() => closeAccount(this.#doc, id, now));
  }

  reopenAccount(id: string, now?: Date) {
    return this.#mutate(() => reopenAccount(this.#doc, id, now));
  }

  deleteAccount(id: string) {
    return this.#mutate(() => deleteAccount(this.#doc, id));
  }

  accountBalance(id: string): number {
    return accountBalance(this.#doc, id);
  }

  // Category groups and categories

  listCategoryGroups() {
    return listCategoryGroups(this.#doc);
  }

  listCategories() {
    return listCategories(this.#doc);
  }

  getCategory(id: string) {
    return getCategory(this.#doc, id);
  }

  getCategoryGroup(id: string) {
    return getCategoryGroup(this.#doc, id);
  }

  createCategoryGroup(input: { name: string; hidden?: boolean }, now?: Date) {
    return this.#mutate(() => createCategoryGroup(this.#doc, input, now));
  }

  updateCategoryGroup(id: string, patch: { name?: string; order?: number; hidden?: boolean }) {
    return this.#mutate(() => updateCategoryGroup(this.#doc, id, patch));
  }

  deleteCategoryGroup(id: string) {
    return this.#mutate(() => deleteCategoryGroup(this.#doc, id));
  }

  createCategory(
    input: { groupId: string; name: string; hidden?: boolean; note?: string },
    now?: Date,
  ) {
    return this.#mutate(() => createCategory(this.#doc, input, now));
  }

  updateCategory(
    id: string,
    patch: { groupId?: string; name?: string; order?: number; hidden?: boolean; note?: string },
    now?: Date,
  ) {
    return this.#mutate(() => updateCategory(this.#doc, id, patch, now));
  }

  deleteCategory(id: string) {
    return this.#mutate(() => deleteCategory(this.#doc, id));
  }

  reorderCategories(groupId: string, orderedIds: readonly string[]) {
    return this.#mutate(() => reorderCategories(this.#doc, groupId, orderedIds));
  }

  // Targets

  listTargets() {
    return listTargets(this.#doc);
  }

  activeTarget(categoryId: string, month: MonthKey): Target | undefined {
    return activeTarget(this.#doc, categoryId, month);
  }

  setTarget(categoryId: string, input: TargetInput, month: MonthKey, now?: Date) {
    return this.#mutate(() => setTarget(this.#doc, categoryId, input, month, now));
  }

  clearTarget(categoryId: string, month: MonthKey, now?: Date) {
    return this.#mutate(() => clearTarget(this.#doc, categoryId, month, now));
  }

  // Months

  listMonthlyBudgets() {
    return listMonthlyBudgets(this.#doc);
  }

  assignedFor(month: MonthKey, categoryId: string): number {
    return assignedFor(this.#doc, month, categoryId);
  }

  assignedByCategory(month: MonthKey): Map<string, number> {
    return assignedByCategory(this.#doc, month);
  }

  setAssigned(month: MonthKey, categoryId: string, amountMinor: number, now?: Date) {
    return this.#mutate(() => setAssigned(this.#doc, month, categoryId, amountMinor, now));
  }

  applyAssignments(month: MonthKey, deltas: ReadonlyMap<string, number>, now?: Date) {
    return this.#mutate(() => applyAssignments(this.#doc, month, deltas, now));
  }

  copyAssignments(from: MonthKey, to: MonthKey, now?: Date) {
    return this.#mutate(() => copyAssignments(this.#doc, from, to, now));
  }

  // Transactions

  listTransactions(accountId?: string) {
    return listTransactions(this.#doc, accountId);
  }

  getTransaction(id: string) {
    return getTransaction(this.#doc, id);
  }

  createTransaction(input: NewTransactionInput, now?: Date) {
    return this.#mutate(() => createTransaction(this.#doc, input, now));
  }

  updateTransaction(
    id: string,
    patch: TransactionPatch,
    now?: Date,
    options: { learn?: boolean } = {},
  ) {
    return this.#mutate(() => {
      const before = getTransaction(this.#doc, id);
      const next = updateTransaction(this.#doc, id, patch, now);
      if (
        options.learn !== false &&
        before &&
        next.categoryId &&
        next.categoryId !== READY_TO_ASSIGN &&
        before.categoryId !== next.categoryId &&
        next.payeeName.length > 0
      ) {
        upsertLearnedCategoryRule(this.#doc, next.payeeName, next.categoryId, now);
      }
      return next;
    });
  }

  /** Groups several mutations into one commit, and therefore one undo step. */
  batch<T>(mutation: () => T): T {
    return this.#mutate(mutation);
  }

  deleteTransaction(id: string) {
    return this.#mutate(() => deleteTransaction(this.#doc, id));
  }

  createTransfer(input: NewTransferInput, now?: Date) {
    return this.#mutate(() => createTransfer(this.#doc, input, now));
  }

  createSplit(input: NewSplitInput, now?: Date) {
    return this.#mutate(() => createSplit(this.#doc, input, now));
  }

  replaceSplits(parentId: string, splits: readonly SplitInput[], now?: Date) {
    return this.#mutate(() => replaceSplits(this.#doc, parentId, splits, now));
  }

  toggleCleared(id: string, now?: Date) {
    return this.#mutate(() => toggleCleared(this.#doc, id, now));
  }

  // Payees

  listPayees() {
    return listPayees(this.#doc);
  }

  getPayee(id: string) {
    return getPayee(this.#doc, id);
  }

  createPayee(input: { name: string; defaultCategoryId?: string | null }, now?: Date) {
    return this.#mutate(() => createPayee(this.#doc, input, now));
  }

  updatePayee(
    id: string,
    patch: {
      name?: string;
      defaultCategoryId?: string | null;
      lastCategoryId?: string | null;
      learn?: boolean;
      archivedAt?: string | null;
    },
  ) {
    return this.#mutate(() => updatePayee(this.#doc, id, patch));
  }

  mergePayees(sourceId: string, targetId: string) {
    return this.#mutate(() => mergePayees(this.#doc, sourceId, targetId));
  }

  deletePayee(id: string) {
    return this.#mutate(() => deletePayee(this.#doc, id));
  }

  learnPayeeName(importedPayee: string, payeeName: string, now?: Date) {
    return this.#mutate(() => upsertLearnedPayeeRule(this.#doc, importedPayee, payeeName, now));
  }

  // Rules

  listRules() {
    return listRules(this.#doc);
  }

  createRule(input: NewRuleInput, now?: Date) {
    return this.#mutate(() => createRule(this.#doc, input, now));
  }

  updateRule(
    id: string,
    patch: Partial<{
      stage: "pre" | "default" | "post";
      enabled: boolean;
      conditions: NewRuleInput["conditions"];
      actions: NewRuleInput["actions"];
    }>,
    now?: Date,
  ) {
    return this.#mutate(() => updateRule(this.#doc, id, patch, now));
  }

  deleteRule(id: string) {
    return this.#mutate(() => deleteRule(this.#doc, id));
  }

  // Schedules

  listSchedules() {
    return listSchedules(this.#doc);
  }

  createSchedule(input: NewScheduleInput, now?: Date) {
    return this.#mutate(() => createSchedule(this.#doc, input, now));
  }

  updateSchedule(id: string, patch: Parameters<typeof updateSchedule>[2], now?: Date) {
    return this.#mutate(() => updateSchedule(this.#doc, id, patch, now));
  }

  deleteSchedule(id: string) {
    return this.#mutate(() => deleteSchedule(this.#doc, id));
  }

  enterSchedule(id: string, now?: Date) {
    return this.#mutate(() => enterSchedule(this.#doc, id, now));
  }

  // Reconciliation

  listReconciliations() {
    return listReconciliations(this.#doc);
  }

  clearedBalance(accountId: string, through: string): number {
    return clearedBalance(this.#doc, accountId, through);
  }

  reconcileAccount(
    input: { accountId: string; statementDate: string; statementBalanceMinor: number },
    now?: Date,
  ) {
    return this.#mutate(() => reconcileAccount(this.#doc, input, now));
  }

  unlockReconciliation(id: string, now?: Date) {
    return this.#mutate(() => unlockReconciliation(this.#doc, id, now));
  }

  // Dashboards

  ensureDefaultDashboard(now?: Date) {
    return this.#mutate(() => ensureDefaultDashboard(this.#doc, now));
  }

  listDashboards() {
    return listDashboards(this.#doc);
  }

  listWidgets(dashboardId?: string) {
    return listWidgets(this.#doc, dashboardId);
  }

  createWidget(input: Parameters<typeof createWidget>[1], now?: Date) {
    return this.#mutate(() => createWidget(this.#doc, input, now));
  }

  updateWidget(id: string, patch: Parameters<typeof updateWidget>[2]) {
    return this.#mutate(() => updateWidget(this.#doc, id, patch));
  }

  deleteWidget(id: string) {
    return this.#mutate(() => deleteWidget(this.#doc, id));
  }

  moveWidget(id: string, direction: -1 | 1) {
    return this.#mutate(() => moveWidget(this.#doc, id, direction));
  }

  // Settings and metadata

  getSettings(): Settings {
    return readSettings(this.#doc);
  }

  updateSettings(patch: Partial<Settings>) {
    return this.#mutate(() => updateSettings(this.#doc, patch));
  }

  getMeta() {
    return readMeta(this.#doc);
  }

  rename(name: string) {
    return this.#mutate(() => {
      const next = { ...readMeta(this.#doc), name };
      writeMeta(this.#doc, next);
      return next;
    });
  }

  applyStarterTemplate(template: StarterTemplateId, now?: Date) {
    return this.#mutate(() => applyTemplate(this.#doc, template, now));
  }

  #mutate<T>(mutation: () => T): T {
    this.#depth += 1;
    try {
      const result = mutation();
      if (this.#depth === 1) this.#doc.commit();
      return result;
    } finally {
      this.#depth -= 1;
    }
  }
}

function initializeMetaAndDashboard(doc: LoroDoc, now: Date, name: string): void {
  initializeMeta(doc, now, name);
  ensureDefaultDashboard(doc, now);
}

function randomPeerId(): bigint {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value === 0n ? 1n : value;
}
