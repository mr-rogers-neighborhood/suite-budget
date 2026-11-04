import { describe, expect, it } from "vitest";

import { BudgetDocument } from "../index";

function base() {
  const doc = BudgetDocument.create({
    name: "Test",
    now: new Date("2026-01-01T12:00:00.000Z"),
  });
  const group = doc.createCategoryGroup({ name: "Group" });
  const one = doc.createCategory({ groupId: group.id, name: "One" });
  const two = doc.createCategory({ groupId: group.id, name: "Two" });
  const account = doc.createAccount({
    name: "Checking",
    type: "checking",
    startingBalanceMinor: 100_000,
    startingDate: "2026-01-01",
  });
  return { doc, group, one, two, account };
}

describe("BudgetDocument", () => {
  it("should round-trip a snapshot", () => {
    const { doc, one } = base();
    doc.setAssigned("2026-01", one.id, 10_000);
    const restored = BudgetDocument.fromSnapshot(doc.snapshot());
    expect(restored.getSnapshot()).toEqual(doc.getSnapshot());
  });

  it("should merge two replicas editing different categories", () => {
    const { doc, one, two } = base();
    const replica = BudgetDocument.fromSnapshot(doc.snapshot());
    const updatesA: Uint8Array[] = [];
    const updatesB: Uint8Array[] = [];
    doc.observe((update) => updatesA.push(update));
    replica.observe((update) => updatesB.push(update));

    doc.setAssigned("2026-01", one.id, 10_000);
    replica.setAssigned("2026-01", two.id, 20_000);
    for (const update of updatesA) replica.applyUpdate(update);
    for (const update of updatesB) doc.applyUpdate(update);

    const a = doc.getSnapshot().monthlyBudgets;
    const b = replica.getSnapshot().monthlyBudgets;
    const sort = (rows: typeof a) =>
      [...rows].sort((left, right) => left.categoryId.localeCompare(right.categoryId));
    expect(sort(b)).toEqual(sort(a));
    expect(a).toHaveLength(2);
  });

  it("should merge concurrent field edits on one transaction", () => {
    const { doc, account, one, two } = base();
    const transaction = doc.createTransaction({
      accountId: account.id,
      date: "2026-01-02",
      amountMinor: -2_000,
      categoryId: one.id,
      payeeName: "Shop",
    });
    const replica = BudgetDocument.fromSnapshot(doc.snapshot());
    const updatesA: Uint8Array[] = [];
    const updatesB: Uint8Array[] = [];
    doc.observe((update) => updatesA.push(update));
    replica.observe((update) => updatesB.push(update));

    doc.updateTransaction(transaction.id, { memo: "from a" });
    replica.updateTransaction(transaction.id, { categoryId: two.id });
    for (const update of updatesA) replica.applyUpdate(update);
    for (const update of updatesB) doc.applyUpdate(update);

    expect(doc.getTransaction(transaction.id)?.memo).toBe("from a");
    expect(doc.getTransaction(transaction.id)?.categoryId).toBe(two.id);
    expect(replica.getTransaction(transaction.id)?.memo).toBe("from a");
  });

  it("should keep split children and the parent in step", () => {
    const { doc, account, one, two } = base();
    const parent = doc.createSplit({
      accountId: account.id,
      date: "2026-01-02",
      payeeName: "Shop",
      splits: [
        { categoryId: one.id, amountMinor: -1_000 },
        { categoryId: two.id, amountMinor: -2_000 },
      ],
    });
    expect(parent.amountMinor).toBe(-3_000);
    const child = doc
      .listTransactions()
      .find(
        (transaction) => transaction.parentId === parent.id && transaction.amountMinor === -1_000,
      );
    expect(child).toBeDefined();
    if (!child) return;
    doc.updateTransaction(child.id, { amountMinor: -1_500 });
    expect(doc.getTransaction(parent.id)?.amountMinor).toBe(-3_500);
    expect(doc.accountBalance(account.id)).toBe(96_500);
  });

  it("should pair a transfer and delete both sides", () => {
    const { doc, account } = base();
    const savings = doc.createAccount({ name: "Savings", type: "savings" });
    const [from, to] = doc.createTransfer({
      fromAccount: account,
      toAccount: savings,
      date: "2026-01-03",
      amountMinor: 5_000,
    });
    expect(doc.accountBalance(account.id)).toBe(95_000);
    expect(doc.accountBalance(savings.id)).toBe(5_000);
    doc.deleteTransaction(from.id);
    expect(doc.getTransaction(to.id)).toBeUndefined();
  });

  it("should undo and redo one mutation at a time", () => {
    const { doc, one } = base();
    doc.setAssigned("2026-01", one.id, 10_000);
    expect(doc.assignedFor("2026-01", one.id)).toBe(10_000);
    doc.undo();
    expect(doc.assignedFor("2026-01", one.id)).toBe(0);
    doc.redo();
    expect(doc.assignedFor("2026-01", one.id)).toBe(10_000);
  });
});
