import { describe, expect, it } from "vitest";

import { applyRules, BudgetDocument, type RuleDraft, ruleSchema } from "../index";

function rule(input: {
  stage?: "pre" | "default" | "post";
  field: "payee" | "importedPayee" | "memo" | "amount" | "cleared";
  op: "is" | "isNot" | "contains" | "doesNotContain" | "matches" | "oneOf" | "notOneOf";
  value: string;
  set?: "setCategory" | "setMemo" | "setFlag" | "setCleared";
  action?: string;
}) {
  return ruleSchema.parse({
    id: `rule_${Math.random().toString(36).slice(2)}`,
    stage: input.stage ?? "default",
    conditions: [{ field: input.field, op: input.op, value: input.value }],
    actions: [{ field: input.set ?? "setCategory", value: input.action ?? "cat_target" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

const draft: RuleDraft = {
  accountId: "acct_1",
  accountName: "Checking",
  payeeName: "Amazon Marketplace",
  importedPayee: "AMZN Mktp US*2H4L",
  categoryId: null,
  categoryName: "",
  date: "2026-01-05",
  memo: "Order 123",
  amountMinor: 1_234,
  cleared: "uncleared",
  flag: null,
};

const context = {
  currency: "USD",
  currencyScale: 2,
  categoryNames: new Map([
    ["cat_broad", "Shopping"],
    ["cat_specific", "Amazon"],
    ["cat_target", "Target"],
  ]),
};

describe("applyRules", () => {
  it("should let a specific rule beat a broad one", () => {
    const rules = [
      rule({ field: "payee", op: "contains", value: "amazon", action: "cat_broad" }),
      rule({ field: "payee", op: "is", value: "amazon marketplace", action: "cat_specific" }),
    ];
    const result = applyRules(draft, rules, context);
    expect(result.draft.categoryId).toBe("cat_specific");
    expect(result.draft.categoryName).toBe("Amazon");
    expect(result.matchedRuleIds).toHaveLength(2);
  });

  it("should let a post-stage rule run last", () => {
    const rules = [
      rule({ field: "payee", op: "is", value: "amazon marketplace", action: "cat_specific" }),
      rule({
        stage: "post",
        field: "memo",
        op: "contains",
        value: "order",
        set: "setMemo",
        action: "matched by post",
      }),
    ];
    const result = applyRules(draft, rules, context);
    expect(result.draft.memo).toBe("matched by post");
  });

  it("should match the imported payee and an amount", () => {
    const rules = [
      rule({ field: "importedPayee", op: "contains", value: "amzn", action: "cat_broad" }),
      rule({ field: "amount", op: "is", value: "12.34", action: "cat_specific" }),
    ];
    const result = applyRules(draft, rules, context);
    expect(result.draft.categoryId).toBe("cat_specific");
  });

  it("should skip disabled rules", () => {
    const disabled = { ...rule({ field: "payee", op: "is", value: "anything" }), enabled: false };
    const result = applyRules(draft, [disabled], context);
    expect(result.draft.categoryId).toBeNull();
  });
});

describe("learned rules", () => {
  it("should learn a category from a manual edit", () => {
    const doc = BudgetDocument.create({ now: new Date("2026-01-01T12:00:00.000Z") });
    const group = doc.createCategoryGroup({ name: "Group" });
    const food = doc.createCategory({ groupId: group.id, name: "Food" });
    const fun = doc.createCategory({ groupId: group.id, name: "Fun" });
    const account = doc.createAccount({ name: "Checking", type: "checking" });
    const transaction = doc.createTransaction({
      accountId: account.id,
      date: "2026-01-02",
      amountMinor: -2_000,
      categoryId: food.id,
      payeeName: "Shop",
    });

    doc.updateTransaction(transaction.id, { categoryId: fun.id });
    const learned = doc.listRules().filter((candidate) => candidate.source === "learned");
    expect(learned).toHaveLength(1);

    const result = applyRules(
      { ...draft, payeeName: "Shop", importedPayee: "SHOP", amountMinor: -2_000 },
      doc.listRules(),
      {
        currency: "USD",
        currencyScale: 2,
        categoryNames: new Map([[fun.id, "Fun"]]),
      },
    );
    expect(result.draft.categoryId).toBe(fun.id);
  });
});
