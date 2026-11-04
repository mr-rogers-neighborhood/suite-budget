import { describe, expect, it } from "vitest";

import { BudgetDocument, monthState } from "../index";

function setup() {
  const doc = BudgetDocument.create({
    name: "Test",
    currency: "USD",
    now: new Date("2026-01-01T12:00:00.000Z"),
  });
  const group = doc.createCategoryGroup({ name: "Everyday" });
  const food = doc.createCategory({ groupId: group.id, name: "Food" });
  const rent = doc.createCategory({ groupId: group.id, name: "Rent" });
  const debt = doc.createCategory({ groupId: group.id, name: "Loan Payments" });

  const checking = doc.createAccount({
    name: "Checking",
    type: "checking",
    startingBalanceMinor: 100_000,
    startingDate: "2026-01-01",
  });
  const savings = doc.createAccount({
    name: "Savings",
    type: "savings",
    startingBalanceMinor: 0,
  });
  const card = doc.createAccount({
    name: "Card",
    type: "credit",
    startingBalanceMinor: -20_000,
    startingDate: "2026-01-01",
  });
  const loan = doc.createAccount({
    name: "Loan",
    type: "loan",
    onBudget: false,
    startingBalanceMinor: -500_000,
    startingDate: "2026-01-01",
  });

  doc.createTransaction({
    accountId: checking.id,
    date: "2026-01-02",
    amountMinor: 200_000,
    categoryId: "rta",
    payeeName: "Employer",
  });
  doc.createTransaction({
    accountId: checking.id,
    date: "2026-01-03",
    amountMinor: -80_000,
    categoryId: rent.id,
    payeeName: "Landlord",
  });
  doc.createTransaction({
    accountId: checking.id,
    date: "2026-01-05",
    amountMinor: -15_000,
    categoryId: food.id,
    payeeName: "Market",
  });
  doc.createTransaction({
    accountId: card.id,
    date: "2026-01-06",
    amountMinor: -5_000,
    categoryId: food.id,
    payeeName: "Market",
  });
  doc.createTransaction({
    accountId: checking.id,
    date: "2026-01-07",
    amountMinor: 2_000,
    categoryId: food.id,
    payeeName: "Market refund",
  });
  doc.createTransfer({
    fromAccount: checking,
    toAccount: loan,
    date: "2026-01-08",
    amountMinor: 10_000,
    categoryId: debt.id,
  });
  doc.createTransfer({
    fromAccount: checking,
    toAccount: savings,
    date: "2026-01-09",
    amountMinor: 30_000,
  });

  doc.setAssigned("2026-01", rent.id, 80_000);
  doc.setAssigned("2026-01", food.id, 20_000);
  doc.setAssigned("2026-01", debt.id, 10_000);

  return { doc, food, rent, debt, checking, savings, card, loan };
}

describe("monthState", () => {
  it("should hold the cash-basis invariant", () => {
    const { doc } = setup();
    const state = monthState(doc.getSnapshot(), "2026-01");
    expect(state.availableMinor + state.readyToAssignMinor).toBe(state.onBudgetBalanceMinor);
    expect(state.onBudgetBalanceMinor).toBe(172_000);
    expect(state.readyToAssignMinor).toBe(170_000);
    expect(state.availableMinor).toBe(2_000);
  });

  it("should show each envelope", () => {
    const { doc, food, rent, debt } = setup();
    const state = monthState(doc.getSnapshot(), "2026-01");
    const rows = state.groups.flatMap((group) => group.categories);
    const byId = new Map(rows.map((row) => [row.category.id, row]));
    expect(byId.get(food.id)?.assignedMinor).toBe(20_000);
    expect(byId.get(food.id)?.activityMinor).toBe(-18_000);
    expect(byId.get(food.id)?.availableMinor).toBe(2_000);
    expect(byId.get(rent.id)?.availableMinor).toBe(0);
    expect(byId.get(debt.id)?.availableMinor).toBe(0);
  });

  it("should roll a negative envelope into the next month's Ready to Assign", () => {
    const { doc, food, checking } = setup();
    doc.createTransaction({
      accountId: checking.id,
      date: "2026-02-03",
      amountMinor: -5_000,
      categoryId: food.id,
      payeeName: "Market",
    });

    const february = monthState(doc.getSnapshot(), "2026-02");
    const foodRow = february.groups
      .flatMap((group) => group.categories)
      .find((row) => row.category.id === food.id);
    expect(foodRow?.availableMinor).toBe(-3_000);
    expect(february.readyToAssignMinor).toBe(170_000);
    expect(february.availableMinor + february.readyToAssignMinor).toBe(
      february.onBudgetBalanceMinor,
    );

    const march = monthState(doc.getSnapshot(), "2026-03");
    const marchFood = march.groups
      .flatMap((group) => group.categories)
      .find((row) => row.category.id === food.id);
    expect(marchFood?.availableMinor).toBe(0);
    expect(march.readyToAssignMinor).toBe(167_000);
  });

  it("should keep off-budget accounts out of Ready to Assign", () => {
    const { doc, loan } = setup();
    const balance = doc.accountBalance(loan.id);
    expect(balance).toBe(-490_000);
    const state = monthState(doc.getSnapshot(), "2026-01");
    expect(state.onBudgetBalanceMinor).toBe(172_000);
  });
});
