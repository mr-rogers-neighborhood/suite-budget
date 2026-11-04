import { parseMoney } from "../money";
import type { ClearedStatus, Rule, RuleCondition, RuleOperator, TransactionFlag } from "../schema";
import { rankRules } from "./rank";

export type RuleDraft = {
  accountId: string;
  accountName: string;
  payeeName: string;
  importedPayee: string;
  categoryId: string | null;
  categoryName: string;
  date: string;
  memo: string;
  amountMinor: number;
  cleared: ClearedStatus;
  flag: TransactionFlag | null;
};

export type RuleContext = {
  currency: string;
  currencyScale: number;
  categoryNames: ReadonlyMap<string, string>;
};

export type RuleResult = {
  draft: RuleDraft;
  matchedRuleIds: string[];
};

export function applyRules(
  draft: RuleDraft,
  rules: readonly Rule[],
  context: RuleContext,
): RuleResult {
  const next: RuleDraft = { ...draft };
  const matchedRuleIds: string[] = [];

  for (const rule of rankRules(rules)) {
    if (!rule.conditions.every((condition) => matches(next, condition, context))) continue;
    matchedRuleIds.push(rule.id);
    for (const action of rule.actions) {
      if (action.field === "setPayee") next.payeeName = action.value;
      if (action.field === "setCategory") {
        next.categoryId = action.value.length > 0 ? action.value : null;
        next.categoryName = context.categoryNames.get(action.value) ?? "";
      }
      if (action.field === "setMemo") next.memo = action.value;
      if (action.field === "setFlag") next.flag = asFlag(action.value);
      if (action.field === "setCleared") next.cleared = asCleared(action.value);
    }
  }

  return { draft: next, matchedRuleIds };
}

function matches(draft: RuleDraft, condition: RuleCondition, context: RuleContext): boolean {
  if (condition.field === "amount") {
    return matchesAmount(draft.amountMinor, condition, context);
  }
  const actual = fieldValue(draft, condition.field);
  return compare(actual, condition.op, condition.value);
}

function fieldValue(draft: RuleDraft, field: RuleCondition["field"]): string {
  if (field === "importedPayee") return draft.importedPayee;
  if (field === "payee") return draft.payeeName;
  if (field === "account") return draft.accountId || draft.accountName;
  if (field === "category") return draft.categoryId || draft.categoryName;
  if (field === "date") return draft.date;
  if (field === "memo") return draft.memo;
  if (field === "cleared") return draft.cleared;
  return "";
}

function matchesAmount(
  amountMinor: number,
  condition: RuleCondition,
  context: RuleContext,
): boolean {
  const parsed = parseMoney(condition.value, context.currency, context.currencyScale);
  if (parsed.isOk()) return compareNumber(amountMinor, condition.op, parsed.value);
  return compare(String(amountMinor), condition.op, condition.value);
}

function compareNumber(actual: number, op: RuleOperator, expected: number): boolean {
  if (op === "is") return actual === expected;
  if (op === "isNot") return actual !== expected;
  if (op === "oneOf") return actual === expected;
  if (op === "notOneOf") return actual !== expected;
  return false;
}

function compare(actual: string, op: RuleOperator, expected: string): boolean {
  const left = actual.toLowerCase();
  const right = expected.toLowerCase();
  if (op === "is") return left === right;
  if (op === "isNot") return left !== right;
  if (op === "contains") return left.includes(right);
  if (op === "doesNotContain") return !left.includes(right);
  if (op === "oneOf") return splitValues(expected).some((value) => value.toLowerCase() === left);
  if (op === "notOneOf")
    return splitValues(expected).every((value) => value.toLowerCase() !== left);
  if (op === "matches") {
    try {
      return new RegExp(expected, "i").test(actual);
    } catch {
      return false;
    }
  }
  return false;
}

function splitValues(value: string): string[] {
  return value
    .split("|")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function asFlag(value: string): TransactionFlag | null {
  const flags: TransactionFlag[] = ["red", "orange", "yellow", "green", "blue", "purple"];
  return flags.includes(value as TransactionFlag) ? (value as TransactionFlag) : null;
}

function asCleared(value: string): ClearedStatus {
  if (value === "cleared" || value === "reconciled") return value;
  return "uncleared";
}
