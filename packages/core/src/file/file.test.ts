import { describe, expect, it } from "vitest";

import {
  BudgetDocument,
  decodeBudgetFile,
  decodeRecords,
  encodeBudgetFile,
  encodeRecords,
} from "../index";

function sample() {
  const doc = BudgetDocument.create({
    name: "Sample",
    currency: "USD",
    now: new Date("2026-01-01T12:00:00.000Z"),
  });
  const group = doc.createCategoryGroup({ name: "Group" });
  const category = doc.createCategory({ groupId: group.id, name: "Food" });
  const account = doc.createAccount({
    name: "Checking",
    type: "checking",
    startingBalanceMinor: 100_000,
    startingDate: "2026-01-01",
  });
  doc.createTransaction({
    accountId: account.id,
    date: "2026-01-02",
    amountMinor: -1_234,
    categoryId: category.id,
    payeeName: "Shop",
  });
  doc.setAssigned("2026-01", category.id, 5_000);
  return { doc, account, category };
}

describe("the .budget envelope", () => {
  it("should round-trip a document", () => {
    const { doc } = sample();
    const encoded = encodeBudgetFile(doc);
    const decoded = decodeBudgetFile(encoded);
    if (decoded.isErr()) throw decoded.error;
    const restored = BudgetDocument.fromSnapshot(decoded.value);
    expect(restored.getSnapshot()).toEqual(doc.getSnapshot());
  });

  it("should reject another app's JSON", () => {
    expect(decodeBudgetFile('{"format":"other"}').isErr()).toBe(true);
    expect(decodeBudgetFile("not json").isErr()).toBe(true);
  });
});

describe("the records envelope", () => {
  it("should round-trip every record", () => {
    const { doc } = sample();
    const encoded = encodeRecords(doc.getSnapshot());
    const decoded = decodeRecords(encoded);
    if (decoded.isErr()) throw decoded.error;
    const restored = BudgetDocument.fromRecords(decoded.value);
    expect(restored.getSnapshot()).toEqual(doc.getSnapshot());
  });

  it("should reject a records file with a broken reference", () => {
    const { doc } = sample();
    const snapshot = doc.getSnapshot();
    const broken = {
      ...snapshot,
      transactions: snapshot.transactions.map((transaction) => ({
        ...transaction,
        categoryId: "missing",
      })),
    };
    const encoded = encodeRecords(broken);
    const decoded = decodeRecords(encoded);
    expect(decoded.isErr()).toBe(true);
  });
});
