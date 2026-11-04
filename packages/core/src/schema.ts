import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const READY_TO_ASSIGN = "rta";

export const timestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Expected an ISO timestamp" });

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expected a yyyy-MM-dd date" });

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Expected a yyyy-MM month" });

export const amountMinorSchema = z.number().int();

export const accountTypeSchema = z.enum(["checking", "savings", "cash", "credit", "loan"]);

export const clearedStatusSchema = z.enum(["uncleared", "cleared", "reconciled"]);

export const transactionFlagSchema = z.enum(["red", "orange", "yellow", "green", "blue", "purple"]);

export const targetKindSchema = z.enum([
  "monthly",
  "needed_for_spending",
  "savings_balance",
  "debt_payoff",
]);

export const ruleStageSchema = z.enum(["pre", "default", "post"]);

export const ruleFieldSchema = z.enum([
  "importedPayee",
  "payee",
  "account",
  "category",
  "date",
  "memo",
  "amount",
  "cleared",
]);

export const ruleOperatorSchema = z.enum([
  "is",
  "isNot",
  "contains",
  "doesNotContain",
  "matches",
  "oneOf",
  "notOneOf",
]);

export const ruleActionFieldSchema = z.enum([
  "setPayee",
  "setCategory",
  "setMemo",
  "setFlag",
  "setCleared",
]);

export const scheduleFrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const widgetKindSchema = z.enum([
  "ready_to_assign",
  "net_worth",
  "spending",
  "income_expense",
  "cash_flow",
  "budget_vs_actual",
  "age_of_money",
  "text",
]);

export const reportRangeSchema = z.enum(["1m", "3m", "6m", "12m", "ytd", "all"]);

export const importSourceSchema = z.enum(["csv", "qif", "json", "budget"]);

export const loanTermsSchema = z
  .object({
    originalBalanceMinor: amountMinorSchema,
    interestRateBps: z.number().int().min(0).max(100_000).default(0),
    minimumPaymentMinor: amountMinorSchema.nullable().default(null),
  })
  .nullable()
  .default(null);

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: accountTypeSchema,
  onBudget: z.boolean().default(true),
  note: z.string().default(""),
  creditLimitMinor: amountMinorSchema.nullable().default(null),
  loan: loanTermsSchema,
  closedAt: timestampSchema.nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categoryGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().default(0),
  hidden: z.boolean().default(false),
  createdAt: timestampSchema,
});

export const categorySchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1),
  order: z.number().default(0),
  hidden: z.boolean().default(false),
  note: z.string().default(""),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const targetSchema = z
  .object({
    id: z.string().min(1),
    categoryId: z.string().min(1),
    kind: targetKindSchema,
    amountMinor: z.number().int().positive(),
    dueMonth: monthKeySchema.nullable().default(null),
    accountId: z.string().nullable().default(null),
    startsOn: monthKeySchema,
    endsOn: monthKeySchema.nullable().default(null),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((target, context) => {
    if (
      (target.kind === "needed_for_spending" || target.kind === "savings_balance") &&
      target.dueMonth === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["dueMonth"],
        message: "A dated target needs a due month",
      });
    }
    if (target.kind === "debt_payoff" && target.accountId === null) {
      context.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "A debt payoff target needs an account",
      });
    }
  });

export const monthlyBudgetSchema = z.object({
  month: monthKeySchema,
  categoryId: z.string().min(1),
  assignedMinor: amountMinorSchema,
  updatedAt: timestampSchema,
});

export const importedMetaSchema = z
  .object({
    source: importSourceSchema,
    externalId: z.string().nullable().default(null),
    importedAt: timestampSchema,
    originalPayee: z.string().default(""),
  })
  .nullable()
  .default(null);

export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  date: dateKeySchema,
  payeeId: z.string().nullable().default(null),
  payeeName: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  amountMinor: amountMinorSchema.refine((value) => value !== 0, {
    message: "A transaction cannot be zero",
  }),
  memo: z.string().default(""),
  cleared: clearedStatusSchema.default("uncleared"),
  flag: transactionFlagSchema.nullable().default(null),
  transferId: z.string().nullable().default(null),
  transferAccountId: z.string().nullable().default(null),
  parentId: z.string().nullable().default(null),
  scheduledId: z.string().nullable().default(null),
  imported: importedMetaSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const payeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  defaultCategoryId: z.string().nullable().default(null),
  lastCategoryId: z.string().nullable().default(null),
  learn: z.boolean().default(true),
  archivedAt: timestampSchema.nullable().default(null),
  createdAt: timestampSchema,
});

export const ruleConditionSchema = z.object({
  field: ruleFieldSchema,
  op: ruleOperatorSchema,
  value: z.string(),
});

export const ruleActionSchema = z.object({
  field: ruleActionFieldSchema,
  value: z.string(),
});

export const ruleSchema = z.object({
  id: z.string().min(1),
  stage: ruleStageSchema.default("default"),
  enabled: z.boolean().default(true),
  conditions: z.array(ruleConditionSchema).min(1),
  actions: z.array(ruleActionSchema).min(1),
  source: z.enum(["user", "learned"]).default("user"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const scheduleSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  payeeId: z.string().nullable().default(null),
  payeeName: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  amountMinor: amountMinorSchema,
  memo: z.string().default(""),
  flag: transactionFlagSchema.nullable().default(null),
  frequency: scheduleFrequencySchema,
  interval: z.number().int().positive().default(1),
  anchorDate: dateKeySchema,
  nextDate: dateKeySchema,
  endDate: dateKeySchema.nullable().default(null),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const reconciliationSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  statementDate: dateKeySchema,
  statementBalanceMinor: amountMinorSchema,
  adjustmentTransactionId: z.string().nullable().default(null),
  createdAt: timestampSchema,
});

export const dashboardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().default(0),
  createdAt: timestampSchema,
});

export const widgetSchema = z.object({
  id: z.string().min(1),
  dashboardId: z.string().min(1),
  kind: widgetKindSchema,
  order: z.number().default(0),
  range: reportRangeSchema.default("6m"),
  accountId: z.string().nullable().default(null),
  categoryGroupId: z.string().nullable().default(null),
  text: z.string().default(""),
  createdAt: timestampSchema,
});

export const settingsSchema = z.object({
  currency: z.string().length(3).default("USD"),
  currencyScale: z.number().int().min(0).max(3).default(2),
  firstDayOfWeek: z.number().int().min(0).max(6).default(0),
  upcomingDays: z.number().int().min(1).max(365).default(30),
  theme: z.enum(["system", "light", "dark"]).default("system"),
  privacyAmounts: z.boolean().default(false),
});

export const budgetMetaSchema = z.object({
  budgetId: z.string().min(1),
  name: z.string().min(1).default("Budget"),
  schemaVersion: z.number().int().positive(),
  createdAt: timestampSchema,
});

export type AccountType = z.infer<typeof accountTypeSchema>;
export type ClearedStatus = z.infer<typeof clearedStatusSchema>;
export type TransactionFlag = z.infer<typeof transactionFlagSchema>;
export type TargetKind = z.infer<typeof targetKindSchema>;
export type RuleStage = z.infer<typeof ruleStageSchema>;
export type RuleField = z.infer<typeof ruleFieldSchema>;
export type RuleOperator = z.infer<typeof ruleOperatorSchema>;
export type RuleActionField = z.infer<typeof ruleActionFieldSchema>;
export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>;
export type WidgetKind = z.infer<typeof widgetKindSchema>;
export type ReportRange = z.infer<typeof reportRangeSchema>;
export type ImportSource = z.infer<typeof importSourceSchema>;

export type LoanTerms = z.infer<typeof loanTermsSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CategoryGroup = z.infer<typeof categoryGroupSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Target = z.infer<typeof targetSchema>;
export type MonthlyBudget = z.infer<typeof monthlyBudgetSchema>;
export type ImportedMeta = z.infer<typeof importedMetaSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Payee = z.infer<typeof payeeSchema>;
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type RuleAction = z.infer<typeof ruleActionSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Reconciliation = z.infer<typeof reconciliationSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Widget = z.infer<typeof widgetSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type BudgetMeta = z.infer<typeof budgetMetaSchema>;

export type BudgetSnapshot = {
  meta: BudgetMeta;
  settings: Settings;
  accounts: Account[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  targets: Target[];
  monthlyBudgets: MonthlyBudget[];
  transactions: Transaction[];
  payees: Payee[];
  rules: Rule[];
  schedules: Schedule[];
  reconciliations: Reconciliation[];
  dashboards: Dashboard[];
  widgets: Widget[];
};
