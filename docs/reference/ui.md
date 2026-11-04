# Interface

The app is one window, one budget, one month at a time.

## Shell

A left sidebar holds the budget name, the three main views (Plan, Accounts, Reports), the accounts with
their balances, and the tools (Schedules, Payees, Rules). The footer holds Export and **All budgets**.
The top bar names the current view and holds Undo, Redo, Search, Import, and Add transaction.

The launcher is the first screen: recent budgets, a new-budget wizard, and an import door. There is no
account and no settings page that belongs to a server.

## Views

### Plan

The month header shows **Ready to Assign**, Assigned, Activity, and Available. Auto-assign and Move money
sit beside the month navigation. The grid is grouped by category group; each row has Assigned, Activity,
and Available, plus a target progress bar.

- Assigned is editable in place. Enter commits and moves down; Escape cancels; arrows move.
- A negative Available says **Overspent** in words, not only in red.
- A banner counts uncategorized transactions and links to the account.
- Row actions: edit target, move money, rename, hide, delete.
- Group actions: add category, rename, hide, delete.
- The footer adds a group.

### Accounts

Without a selected account, the view lists accounts as cards with balances. With one selected, the
header shows the balance, cleared balance, type, and budget membership, and the register lists
transactions newest first.

- Click a row to edit it. A split row expands to its children.
- The cleared control toggles cleared/uncleared. Reconciled rows show a lock.
- Search filters payee, memo, and category.
- Add transaction, Reconcile, and Edit account sit in the header.

### Transaction editor

Account, date, payee, direction, amount, category, memo, flag, cleared. **Split** turns the amount into
child lines; **Transfer to another account** creates a pair. A category is required only when a
transfer crosses the budget boundary. A reconciled row is read-only.

### Reconcile

Enter the statement date and balance. The sheet shows cleared, statement, and difference. Rows already
cleared through that date become reconciled; a non-zero difference becomes a balance adjustment.
History lists past reconciliations with an Unlock action.

### Reports

Tabs: Dashboard, Net worth, Spending, Income vs expense, Cash flow, Budget vs actual, Age of money. A
range picker applies to the series. Every chart has a data table under it. The dashboard has widgets
(Ready to Assign, net worth, spending, income vs expense, cash flow, budget vs actual, age of money,
text) that can be added, removed, and reordered.

### Rules, Schedules, Payees

- Rules: staged, ordered list with a plain-language summary, enable/disable, edit, delete, and "Run
  rules" with a change count. Learned rules carry a badge.
- Schedules: upcoming entries for the configured window with an Enter button, then the schedule list.
- Payees: default category, last used category, transaction count, and a learning toggle. Merge moves
  every transaction from one payee to another.

### Import

Choose a CSV or QIF file, map the columns, preview, then review. The review can skip likely duplicates
and create missing categories. Errors name the row; the good rows still import.

## Keyboard

| Key                               | Action                                        |
| --------------------------------- | --------------------------------------------- |
| `Cmd/Ctrl+K`                      | Command palette, including one-line quick add |
| `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` | Undo / redo a document change                 |
| `Cmd/Ctrl+N`                      | New budget                                    |
| `Cmd/Ctrl+O`                      | Open a file                                   |
| `Cmd/Ctrl+Shift+B`                | All budgets                                   |
| `Cmd/Ctrl+Shift+E`                | Export the budget file                        |
| `Cmd/Ctrl+1/2/3`                  | Plan / Accounts / Reports                     |
| `Enter`                           | Commit an amount and move down                |
| `Escape`                          | Cancel an edit                                |
| `ArrowUp` / `ArrowDown`           | Move between amount rows                      |

Quick add reads `-42.50 Coffee @Checking #food yesterday`: the first amount token is the amount,
`@name` picks an account, `#name` picks a category, `today`/`yesterday`/`tomorrow` or a `yyyy-MM-dd`
date sets the day, and the remaining words are the payee. Unresolved tokens leave the field alone; the
preview shows exactly what will be created.

## Words

**Ready to Assign** · **Assigned** · **Activity** · **Available**. A category is an envelope. A transfer
is not spending. A split parent is a container. A schedule is a template. A target is a suggestion.
"Close" an account; "remove" a budget from the library; do not say "archive" for a transaction.

## Empty states

- Launcher, no budgets: start a budget or import a file.
- Plan, no accounts: add an account. No categories: add a group or use a template.
- Register, no transactions: add one, or import.
- Reports, not enough data: say what is missing, not "no data".
- Import, unreadable file: name the format and the next step.

## Accessibility

Radix primitives first. Every icon-only control has an accessible name and a title. Focus is visible and
defined once. The register and the plan are tables with headers; amounts use tabular numerals. State is
never colour alone: **Overspent**, **Funded**, **Left**, **Reconciled** are words. Charts have a role,
an accessible name, and a table. `prefers-reduced-motion` is respected. Storybook runs the a11y addon.

## Theme

Dark first, system light. The surfaces and typography match Suite Planner; the accent is Suite Budget's
green. Charts use the five chart tokens and remain legible in both schemes.
