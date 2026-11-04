import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

import {
  accountSchema,
  type BudgetSnapshot,
  budgetMetaSchema,
  categoryGroupSchema,
  categorySchema,
  dashboardSchema,
  monthlyBudgetSchema,
  payeeSchema,
  reconciliationSchema,
  ruleSchema,
  scheduleSchema,
  settingsSchema,
  targetSchema,
  timestampSchema,
  transactionSchema,
  widgetSchema,
} from "../schema";

export const RECORDS_FORMAT = "suite.budget.records";
export const RECORDS_VERSION = 1;

export const recordsEnvelopeSchema = z.object({
  format: z.literal(RECORDS_FORMAT),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  exportedAt: timestampSchema,
  meta: budgetMetaSchema,
  settings: settingsSchema,
  accounts: z.array(accountSchema),
  categoryGroups: z.array(categoryGroupSchema),
  categories: z.array(categorySchema),
  targets: z.array(targetSchema),
  monthlyBudgets: z.array(monthlyBudgetSchema),
  transactions: z.array(transactionSchema),
  payees: z.array(payeeSchema),
  rules: z.array(ruleSchema),
  schedules: z.array(scheduleSchema),
  reconciliations: z.array(reconciliationSchema),
  dashboards: z.array(dashboardSchema),
  widgets: z.array(widgetSchema),
});

export type RecordsEnvelope = z.infer<typeof recordsEnvelopeSchema>;

export type RecordsFileErrorCode =
  | "not-json"
  | "wrong-format"
  | "unsupported-version"
  | "invalid-records";

export class RecordsFileError extends Error {
  constructor(
    readonly code: RecordsFileErrorCode,
    message: string,
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = "RecordsFileError";
  }
}

export function encodeRecords(snapshot: BudgetSnapshot, now: Date = new Date()): string {
  const envelope: RecordsEnvelope = {
    format: RECORDS_FORMAT,
    formatVersion: RECORDS_VERSION,
    schemaVersion: snapshot.meta.schemaVersion,
    exportedAt: now.toISOString(),
    meta: snapshot.meta,
    settings: snapshot.settings,
    accounts: snapshot.accounts,
    categoryGroups: snapshot.categoryGroups,
    categories: snapshot.categories,
    targets: snapshot.targets,
    monthlyBudgets: snapshot.monthlyBudgets,
    transactions: snapshot.transactions,
    payees: snapshot.payees,
    rules: snapshot.rules,
    schedules: snapshot.schedules,
    reconciliations: snapshot.reconciliations,
    dashboards: snapshot.dashboards,
    widgets: snapshot.widgets,
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function decodeRecords(raw: string): Result<BudgetSnapshot, RecordsFileError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err(new RecordsFileError("not-json", "The file is not valid JSON"));
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== RECORDS_FORMAT
  ) {
    return err(
      new RecordsFileError("wrong-format", "The file is not a Suite Budget records export"),
    );
  }
  if ((parsed as { formatVersion?: number }).formatVersion !== undefined) {
    const version = (parsed as { formatVersion: number }).formatVersion;
    if (version > RECORDS_VERSION) {
      return err(
        new RecordsFileError(
          "unsupported-version",
          `Records version ${version} is newer than this build understands`,
        ),
      );
    }
  }

  const result = recordsEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    return err(
      new RecordsFileError(
        "invalid-records",
        "The records file does not match the budget schema",
        result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      ),
    );
  }

  const snapshot = toSnapshot(result.data);
  const problems = validateReferences(snapshot);
  if (problems.length > 0) {
    return err(
      new RecordsFileError("invalid-records", "The records file has broken references", problems),
    );
  }
  return ok(snapshot);
}

function toSnapshot(envelope: RecordsEnvelope): BudgetSnapshot {
  return {
    meta: envelope.meta,
    settings: envelope.settings,
    accounts: envelope.accounts,
    categoryGroups: envelope.categoryGroups,
    categories: envelope.categories,
    targets: envelope.targets,
    monthlyBudgets: envelope.monthlyBudgets,
    transactions: envelope.transactions,
    payees: envelope.payees,
    rules: envelope.rules,
    schedules: envelope.schedules,
    reconciliations: envelope.reconciliations,
    dashboards: envelope.dashboards,
    widgets: envelope.widgets,
  };
}

export function validateReferences(snapshot: BudgetSnapshot): string[] {
  const problems: string[] = [];
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));
  const groupIds = new Set(snapshot.categoryGroups.map((group) => group.id));
  const categoryIds = new Set(snapshot.categories.map((category) => category.id));
  const payeeIds = new Set(snapshot.payees.map((payee) => payee.id));
  const transactionIds = new Set(snapshot.transactions.map((transaction) => transaction.id));
  const dashboardIds = new Set(snapshot.dashboards.map((dashboard) => dashboard.id));

  const unique = (label: string, ids: readonly string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label} ${id} is duplicated`);
      seen.add(id);
    }
  };
  unique(
    "account",
    snapshot.accounts.map((account) => account.id),
  );
  unique(
    "category group",
    snapshot.categoryGroups.map((group) => group.id),
  );
  unique(
    "category",
    snapshot.categories.map((category) => category.id),
  );
  unique(
    "target",
    snapshot.targets.map((target) => target.id),
  );
  unique(
    "transaction",
    snapshot.transactions.map((transaction) => transaction.id),
  );
  unique(
    "payee",
    snapshot.payees.map((payee) => payee.id),
  );
  unique(
    "rule",
    snapshot.rules.map((rule) => rule.id),
  );
  unique(
    "schedule",
    snapshot.schedules.map((schedule) => schedule.id),
  );

  for (const category of snapshot.categories) {
    if (!groupIds.has(category.groupId)) problems.push(`category ${category.id} has no group`);
  }
  for (const target of snapshot.targets) {
    if (!categoryIds.has(target.categoryId)) problems.push(`target ${target.id} has no category`);
    if (target.accountId && !accountIds.has(target.accountId)) {
      problems.push(`target ${target.id} has no account`);
    }
  }
  for (const budget of snapshot.monthlyBudgets) {
    if (!categoryIds.has(budget.categoryId)) {
      problems.push(`budget ${budget.month}:${budget.categoryId} has no category`);
    }
  }
  for (const transaction of snapshot.transactions) {
    if (!accountIds.has(transaction.accountId)) {
      problems.push(`transaction ${transaction.id} has no account`);
    }
    if (
      transaction.categoryId &&
      transaction.categoryId !== "rta" &&
      !categoryIds.has(transaction.categoryId)
    ) {
      problems.push(`transaction ${transaction.id} has no category`);
    }
    if (transaction.payeeId && !payeeIds.has(transaction.payeeId)) {
      problems.push(`transaction ${transaction.id} has no payee`);
    }
    if (transaction.parentId && !transactionIds.has(transaction.parentId)) {
      problems.push(`transaction ${transaction.id} has no parent`);
    }
    if (transaction.transferAccountId && !accountIds.has(transaction.transferAccountId)) {
      problems.push(`transaction ${transaction.id} has no transfer account`);
    }
  }
  for (const schedule of snapshot.schedules) {
    if (!accountIds.has(schedule.accountId))
      problems.push(`schedule ${schedule.id} has no account`);
    if (schedule.categoryId && !categoryIds.has(schedule.categoryId)) {
      problems.push(`schedule ${schedule.id} has no category`);
    }
    if (schedule.payeeId && !payeeIds.has(schedule.payeeId)) {
      problems.push(`schedule ${schedule.id} has no payee`);
    }
  }
  for (const reconciliation of snapshot.reconciliations) {
    if (!accountIds.has(reconciliation.accountId)) {
      problems.push(`reconciliation ${reconciliation.id} has no account`);
    }
  }
  for (const widget of snapshot.widgets) {
    if (!dashboardIds.has(widget.dashboardId)) {
      problems.push(`widget ${widget.id} has no dashboard`);
    }
  }
  return problems;
}
