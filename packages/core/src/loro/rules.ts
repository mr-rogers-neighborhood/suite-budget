import type { LoroDoc } from "loro-crdt";

import { createId } from "../ids";
import {
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleStage,
  ruleSchema,
} from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, insertRecord, listRecords, updateRecord } from "./records";

export type NewRuleInput = {
  stage?: RuleStage;
  conditions: RuleCondition[];
  actions: RuleAction[];
  source?: "user" | "learned";
};

export function listRules(doc: LoroDoc): Rule[] {
  const stageOrder: Record<RuleStage, number> = { pre: 0, default: 1, post: 2 };
  return listRecords(doc, ROOTS.rules, ruleSchema).sort(
    (left, right) =>
      stageOrder[left.stage] - stageOrder[right.stage] ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

export function createRule(doc: LoroDoc, input: NewRuleInput, now: Date = new Date()): Rule {
  const timestamp = now.toISOString();
  const rule = ruleSchema.parse({
    id: createId("rule"),
    stage: input.stage ?? "default",
    enabled: true,
    conditions: input.conditions,
    actions: input.actions,
    source: input.source ?? "user",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.rules, ruleSchema, rule);
  return rule;
}

export function updateRule(
  doc: LoroDoc,
  id: string,
  patch: Partial<Pick<Rule, "stage" | "enabled" | "conditions" | "actions">>,
  now: Date = new Date(),
): Rule {
  return updateRecord(doc, ROOTS.rules, id, ruleSchema, patch, {
    key: "updatedAt",
    value: now.toISOString(),
  });
}

export function deleteRule(doc: LoroDoc, id: string): void {
  deleteRecord(doc, ROOTS.rules, id);
}

export function upsertLearnedCategoryRule(
  doc: LoroDoc,
  payeeName: string,
  categoryId: string,
  now: Date = new Date(),
): Rule {
  const existing = listRules(doc).find(
    (rule) =>
      rule.source === "learned" &&
      rule.conditions.length === 1 &&
      rule.conditions[0]?.field === "payee" &&
      rule.conditions[0]?.op === "is" &&
      rule.conditions[0]?.value === payeeName,
  );
  if (existing) {
    return updateRule(
      doc,
      existing.id,
      { actions: [{ field: "setCategory", value: categoryId }] },
      now,
    );
  }
  return createRule(
    doc,
    {
      conditions: [{ field: "payee", op: "is", value: payeeName }],
      actions: [{ field: "setCategory", value: categoryId }],
      source: "learned",
    },
    now,
  );
}

export function upsertLearnedPayeeRule(
  doc: LoroDoc,
  importedPayee: string,
  payeeName: string,
  now: Date = new Date(),
): Rule {
  const existing = listRules(doc).find(
    (rule) =>
      rule.source === "learned" &&
      rule.conditions.length === 1 &&
      rule.conditions[0]?.field === "importedPayee" &&
      rule.conditions[0]?.op === "contains" &&
      rule.conditions[0]?.value.toLowerCase() === importedPayee.toLowerCase(),
  );
  if (existing) {
    return updateRule(
      doc,
      existing.id,
      { actions: [{ field: "setPayee", value: payeeName }] },
      now,
    );
  }
  return createRule(
    doc,
    {
      conditions: [{ field: "importedPayee", op: "contains", value: importedPayee }],
      actions: [{ field: "setPayee", value: payeeName }],
      source: "learned",
    },
    now,
  );
}
