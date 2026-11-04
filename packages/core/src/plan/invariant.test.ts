import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { BudgetDocument, monthState } from "../index";

const transactionArb = fc.record({
  month: fc.integer({ min: 0, max: 2 }),
  day: fc.integer({ min: 1, max: 28 }),
  amount: fc.integer({ min: -50_000, max: 50_000 }).filter((value) => value !== 0),
  category: fc.constantFrom("rta", "one", "two", "none"),
  account: fc.constantFrom("checking", "credit"),
});

const assignmentArb = fc.record({
  month: fc.integer({ min: 0, max: 2 }),
  category: fc.constantFrom("one", "two"),
  amount: fc.integer({ min: 0, max: 60_000 }),
});

const scenarioArb = fc.record({
  checkingStart: fc.integer({ min: 0, max: 400_000 }),
  creditStart: fc.integer({ min: -150_000, max: 0 }),
  transactions: fc.array(transactionArb, { maxLength: 14 }),
  assignments: fc.array(assignmentArb, { maxLength: 8 }),
});

describe("the cash-basis invariant", () => {
  it("should hold across generated budgets", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const doc = BudgetDocument.create({
          currency: "USD",
          now: new Date("2026-01-01T12:00:00.000Z"),
        });
        const group = doc.createCategoryGroup({ name: "Group" });
        const one = doc.createCategory({ groupId: group.id, name: "One" });
        const two = doc.createCategory({ groupId: group.id, name: "Two" });
        const checking = doc.createAccount({
          name: "Checking",
          type: "checking",
          startingBalanceMinor: scenario.checkingStart,
          startingDate: "2026-01-01",
        });
        const credit = doc.createAccount({
          name: "Card",
          type: "credit",
          startingBalanceMinor: scenario.creditStart,
          startingDate: "2026-01-01",
        });

        const ids: Record<string, string | null> = {
          rta: "rta",
          one: one.id,
          two: two.id,
          none: null,
        };

        for (const transaction of scenario.transactions) {
          const month = String(transaction.month + 1).padStart(2, "0");
          const day = String(transaction.day).padStart(2, "0");
          doc.createTransaction({
            accountId: transaction.account === "checking" ? checking.id : credit.id,
            date: `2026-${month}-${day}`,
            amountMinor: transaction.amount,
            categoryId: ids[transaction.category] ?? null,
            payeeName: "Payee",
          });
        }
        for (const assignment of scenario.assignments) {
          const month = `2026-${String(assignment.month + 1).padStart(2, "0")}`;
          doc.setAssigned(
            month,
            assignment.category === "one" ? one.id : two.id,
            assignment.amount,
          );
        }

        const snapshot = doc.getSnapshot();
        for (let index = 0; index < 3; index += 1) {
          const month = `2026-${String(index + 1).padStart(2, "0")}`;
          const state = monthState(snapshot, month);
          expect(state.availableMinor + state.readyToAssignMinor).toBe(state.onBudgetBalanceMinor);

          const rows = state.groups.flatMap((groupState) => groupState.categories);
          const sum = rows.reduce((total, row) => total + row.availableMinor, 0);
          expect(sum).toBe(state.availableMinor);

          if (index > 0) {
            const previousMonth = `2026-${String(index).padStart(2, "0")}`;
            const previous = monthState(snapshot, previousMonth);
            for (const row of rows) {
              const before = previous.groups
                .flatMap((groupState) => groupState.categories)
                .find((candidate) => candidate.category.id === row.category.id);
              const carry = Math.max(0, before?.availableMinor ?? 0);
              expect(row.availableMinor).toBe(carry + row.assignedMinor + row.activityMinor);
            }
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});
