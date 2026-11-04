# ADR-0007: Transfers are pairs; splits are child records

- Status: accepted
- Date: 2026-01-05

## Context

A transfer has two sides, and a split has several category lines. Storing either as an array on one
record would make concurrent edits overwrite the whole array.

## Decision

- A transfer is two linked transactions sharing `transferId` and opposite amounts. Editing amount, date,
  or cleared status updates the pair in one mutation.
- A split is a parent transaction plus child transactions with `parentId`. The parent stores the total;
  children store their category and amount. Balance uses the parent; activity uses the children.

## Consequences

- Both structures merge per field or per record.
- The register can show a parent as one row and expand its children.
- A transfer is not spending, so it carries no category when both accounts are on budget.
- An on-budget to off-budget transfer carries a category on the on-budget side.
