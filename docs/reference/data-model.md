# Data model

The schema is `packages/core/src/schema.ts`. Zod is the source of truth; types are `z.infer`. Every
write is parsed before it reaches the CRDT.

## Roots

One Loro document holds these roots. Only `BudgetDocument` mutates them.

| Root              | Key                  | Record                                                     |
| ----------------- | -------------------- | ---------------------------------------------------------- |
| `meta`            | —                    | budget id, name, schema version, created timestamp         |
| `settings`        | —                    | currency, scale, first day of week, upcoming window, theme |
| `accounts`        | account id           | `account`                                                  |
| `categoryGroups`  | group id             | `categoryGroup`                                            |
| `categories`      | category id          | `category`                                                 |
| `targets`         | target id            | `target`                                                   |
| `monthlyBudgets`  | `yyyy-MM:categoryId` | `monthlyBudget`                                            |
| `transactions`    | transaction id       | `transaction`                                              |
| `payees`          | payee id             | `payee`                                                    |
| `rules`           | rule id              | `rule`                                                     |
| `schedules`       | schedule id          | `schedule`                                                 |
| `reconciliations` | reconciliation id    | `reconciliation`                                           |
| `dashboards`      | dashboard id         | `dashboard`                                                |
| `widgets`         | widget id            | `widget`                                                   |

Every record is a mergeable map, so a field write is a leaf write. No record contains a whole list that
two clients would overwrite; splits are child records, transfers are paired records, and widgets are
their own records.

## Records

### account

`id`, `name`, `type` (`checking` \| `savings` \| `cash` \| `credit` \| `loan`), `onBudget`, `note`,
`creditLimitMinor` (nullable), `loan` (`{ originalBalanceMinor, interestRateBps, minimumPaymentMinor }`
or null), `closedAt` (nullable), `createdAt`, `updatedAt`.

An on-budget account must reach a zero balance before it can close. Off-budget accounts may close with a
balance. Type and budget membership are immutable after creation.

### categoryGroup and category

- `categoryGroup`: `id`, `name`, `order`, `hidden`, `createdAt`.
- `category`: `id`, `groupId`, `name`, `order`, `hidden`, `note`, `createdAt`, `updatedAt`.

Deleting a category removes its targets and assignments and sets its transactions to uncategorized.
Deleting a group requires it to be empty.

### target

A versioned suggestion, not a stored monthly amount.

`id`, `categoryId`, `kind` (`monthly` \| `needed_for_spending` \| `savings_balance` \| `debt_payoff`),
`amountMinor`, `dueMonth` (nullable), `accountId` (nullable, required for debt), `startsOn`, `endsOn`
(nullable), `createdAt`, `updatedAt`.

Editing a target closes the current record at the previous month and opens a new one at the current
month. Past months recompute against the target that applied then.

### monthlyBudget

`month` (`yyyy-MM`), `categoryId`, `assignedMinor`, `updatedAt`. Sparse: a category with no allocation
has no record, which is different from a record with zero.

### transaction

`id`, `accountId`, `date` (`yyyy-MM-dd`), `payeeId` (nullable), `payeeName`, `categoryId`
(category id, `"rta"`, or null), `amountMinor` (signed, account perspective), `memo`, `cleared`
(`uncleared` \| `cleared` \| `reconciled`), `flag` (nullable colour), `transferId` (nullable),
`transferAccountId` (nullable), `parentId` (nullable), `scheduledId` (nullable), `imported`
(`{ source, externalId, importedAt, originalPayee }` or null), `createdAt`, `updatedAt`.

- A split parent has `categoryId: null` and children with `parentId` set. The parent's amount is the sum
  of its children; the parent is a grouping row, never a category write.
- A transfer pair shares a `transferId` and opposite amounts. Both on-budget: no category. One
  off-budget: the on-budget side carries a category, because money left the budget.
- `categoryId: "rta"` is income to Ready to Assign. A positive amount adds money; a starting balance
  uses the same category.
- `categoryId: null` is uncategorized. It affects the on-budget balance and therefore Ready to Assign,
  and the Plan shows a review banner.
- A reconciled row is read-only until the reconciliation is unlocked.

### payee

`id`, `name`, `defaultCategoryId` (nullable), `lastCategoryId` (nullable), `learn`, `archivedAt`
(nullable), `createdAt`.

### rule

`id`, `stage` (`pre` \| `default` \| `post`), `enabled`, `conditions` (`{ field, op, value }[]`),
`actions` (`{ field, value }[]`), `source` (`user` \| `learned`), `createdAt`, `updatedAt`.

Fields: `importedPayee`, `payee`, `account`, `category`, `date`, `memo`, `amount`, `cleared`. Operators:
`is`, `isNot`, `contains`, `doesNotContain`, `matches`, `oneOf`, `notOneOf`. Actions: `setPayee`,
`setCategory`, `setMemo`, `setFlag`, `setCleared`.

### schedule

`id`, `accountId`, `payeeId` (nullable), `payeeName`, `categoryId` (nullable), `amountMinor`, `memo`,
`flag`, `frequency` (`daily` \| `weekly` \| `monthly` \| `yearly`), `interval`, `anchorDate`,
`nextDate`, `endDate` (nullable), `createdAt`, `updatedAt`. There is no `autoEnter` field.

### reconciliation

`id`, `accountId`, `statementDate`, `statementBalanceMinor`, `adjustmentTransactionId` (nullable),
`createdAt`.

### dashboard and widget

- `dashboard`: `id`, `name`, `order`, `createdAt`.
- `widget`: `id`, `dashboardId`, `kind` (`ready_to_assign`, `net_worth`, `spending`, `income_expense`,
  `cash_flow`, `budget_vs_actual`, `age_of_money`, `text`), `order`, `range`, `accountId` (nullable),
  `categoryGroupId` (nullable), `text`, `createdAt`.

### settings

`currency`, `currencyScale`, `firstDayOfWeek`, `upcomingDays`, `theme`, `privacyAmounts` (reserved).

## Derived, never stored

- Month state: per category `assigned`, `activity`, `available`; month totals and Ready to Assign.
- Carry-in: the previous month's positive Available; zero for the budget's first month.
- Account balance through a date: starting balance plus every transaction on the account.
- Transfer activity: zero when both sides are on budget; the categorized side when one is off.
- Split parent total: sum of child records.
- Target suggestion and funded state.
- Upcoming entries: schedule expansion over `upcomingDays`.
- Duplicates: fuzzy candidates at import time.
- Report series: net worth, spending, income vs expense, cash flow, budget vs actual, age of money.
- Dashboard layout order.

A derived value may be cached only if it can be thrown away and rebuilt from the document. The
renderer's snapshot is exactly that.

## Month math

For each category `c` and month `M`:

```
carryIn(c, M)  = M is first month ? 0 : max(0, available(c, M - 1))
activity(c, M) = sum(amountMinor of categorized transactions dated in M belonging to c)
available(c, M) = carryIn(c, M) + assigned(c, M) + activity(c, M)
readyToAssign(M) = onBudgetBalanceAtEnd(M) - sum(available(c, M))
```

Notes that matter:

- **First month** is the earliest month that has a transaction, an allocation, or a target. Before it,
  nothing exists.
- **A negative Available is shown in its month**, then closed at the boundary: the next month starts the
  category at zero and Ready to Assign drops by the deficit. Assigning money to the negative category in
  the same month covers it explicitly, and then nothing is deducted.
- **Income** is a transaction with `categoryId === "rta"`; it raises Ready to Assign through the
  on-budget balance.
- **Refunds** are positive categorized transactions; they raise the category's Available.
- **Credit card spending** is a negative transaction on an on-budget card. It reduces the category and
  the on-budget balance at the same time, so the invariant holds with no payment category.
- **Transfers between on-budget accounts** net to zero and carry no category.
- **Transfers to an off-budget account** carry a category on the on-budget side and count as activity.
- **Split children** are the transactions that count toward activity; the parent is invisible to math.
- **Reconciliation adjustments** are transactions categorized to `rta` (on budget) or uncategorized
  (off budget), with payee `Reconciliation Balance Adjustment`.
- **Hidden categories** still count; hiding is a display choice.

### The invariant

```
sum(available for every category) + readyToAssign = onBudgetBalance
```

The property test in `packages/core/src/plan/invariant.test.ts` generates documents and asserts it. A
hand-computed month in `monthState.test.ts` covers income, assigned, an overspend, a credit card, an
on/off-budget transfer, a split, a refund, and an uncategorized row.

## Targets

| Kind                  | Suggestion for month `M`                                  | Funded when                              |
| --------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `monthly`             | `amountMinor − available`, ≥ 0                            | `available ≥ amountMinor`                |
| `needed_for_spending` | `(amountMinor − available) / monthsRemaining`, rounded up | `available ≥ amountMinor` by `dueMonth`  |
| `savings_balance`     | `(amountMinor − available) / monthsRemaining`, rounded up | `available ≥ amountMinor` by `dueMonth`  |
| `debt_payoff`         | `linkedAccountDebt / monthsRemaining`, rounded up         | linked account balance ≤ 0 by `dueMonth` |

`monthsRemaining` counts the current month through the due month. Debt payoff ignores interest in v1 and
says so in the editor; `loan.interestRateBps` is stored for a later amortizing version.

## Auto-assign

Each action is a pure function returning `Map<categoryId, deltaMinor>`; the UI previews the total, then
one document mutation writes the deltas and commits once.

| Action               | Behavior                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `underfunded`        | Assign each category's suggestion, in category order, until Ready to Assign is exhausted; report the shortfall    |
| `last_month`         | Copy the previous month's `assignedMinor` per category                                                            |
| `average_spent`      | Assign the 3-month average of absolute activity per category, excluding the current month                         |
| `cover_overspending` | Assign exactly the negative Available total into the negative categories from Ready to Assign; report a shortfall |

Manual money moves pick a source (any category with positive Available, or Ready to Assign) and a
destination, and show the effect before committing.

## Rules

Rules run in three stages (`pre`, `default`, `post`). Within a stage they are ranked by specificity —
`is`/`isNot` before `oneOf`, before `contains`, before `matches` — then by creation time, then by id, so
the result is deterministic. Broad rules run first; the last matching action for a field wins. Rules run
on import and when the user chooses "Run rules" on the document.

Learned rules: when the user sets a category on a transaction with a known payee, a learned
`payee is <name> → set category` rule is created or updated. Renaming a payee creates or updates a
learned `importedPayee contains <original> → set payee` rule. A learned rule is a normal record the user
can edit or disable.

## Schedules

A schedule stores its anchor day, so a monthly bill on the 31st clamps to the last day of short months
and returns to the 31st afterwards. `nextDate` is the next occurrence; entering it creates a transaction
with `scheduledId` and advances `nextDate`. Upcoming entries are derived for `settings.upcomingDays`.
There is no background auto-enter: the app does not create transactions while closed.

## Imports

All parsers are pure and return `Result<ImportBatch, ImportError>`; the renderer presents the mapping,
preview, and review.

| Format       | v1       | Notes                                                                                                                                |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CSV          | Yes      | mapping wizard: delimiter, header, date format, payee, memo, amount or inflow/outflow, category, skip rows, negate; RFC 4180 quoting |
| QIF          | Yes      | `!Type:Bank` records, splits (`S`/`E`/`$`), transfers (`[Account]`), cleared flag, category names                                    |
| Native JSON  | Yes      | `suite.budget.records`, Zod-validated, opens as a new budget                                                                         |
| `.budget`    | Yes      | opens the snapshot as a new budget in the library                                                                                    |
| OFX/QFX/CAMT | Deferred | the adapter seam exists; no parser ships                                                                                             |

Dedupe: exact external id first; otherwise candidates in the same account with an equal amount, a date
within ±3 days, and normalized payee similarity. The review list offers skip or import, per row and in
bulk.

Import order: parse → map → rules → dedupe → review → commit as one document mutation.

## File formats

A `.budget` file is a JSON envelope:

```json
{
  "format": "suite.budget",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-01-05T09:00:00.000Z",
  "snapshot": "<base64 Loro snapshot>"
}
```

`decodeBudgetFile` returns a `Result` and rejects bad JSON, another app's JSON, a newer format, and a
snapshot that will not decode. Import then builds a fresh document and validates every record before it
is written.

The records export is `suite.budget.records` and contains every root as plain arrays plus `meta`,
`settings`, `format`, `formatVersion`, `schemaVersion`, and `exportedAt`. It is the "nothing is trapped"
artifact. CSV and QIF exports carry transactions only.

The live file is the same envelope. A `.budget` file is readable by anyone who has it; use OS disk
encryption. The app adds no passphrase.
