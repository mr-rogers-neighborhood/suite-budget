# Coding conventions

The rules as rules. The model they serve is [architecture.md](architecture.md), the records are in
[data-model.md](data-model.md), and the reasoning is in [../adr/README.md](../adr/README.md).

## Shape: pure core, imperative shell

Pure modules take data and return data: `schema`, `money`, `dates`, `ids`, `plan/*`, `rules/*`,
`import/*`, `reports/*`, file decoding, template data. No DOM, no Loro, no `fs`, no `fetch`, no timers,
and a test that needs none of them.

Shell modules own state or I/O: `BudgetDocument` and its domain modules, the Electron main process, the
library and file store, recovery, IPC handlers, preload, React hosts.

Dependencies point inward. A pure module that imports `loro/BudgetDocument` is a bug; pass plain values
down and interpret results up.

One owner per piece of state. Document truth lives in Loro through `BudgetDocument`; UI state lives in
Zustand; transient view state may live in React. Never keep a second copy.

## Money

- Amounts are signed integer minor units. Negative is an outflow.
- `packages/core/src/money.ts` owns `parseMoney`, `formatMoney`, `formatMoneyPlain`, and
  `currencyScale`.
- `parseFloat` and `toFixed` are banned outside `money.ts` and tests; `pnpm shape` enforces it.
- Never add two currencies. One budget has one currency and one scale.
- Rounding happens once, at parse time or at a target suggestion; never in a loop.

## Files and folders

Folder by feature, not by file type: `packages/core/src/{loro,plan,rules,import,file,reports,templates}`,
`apps/desktop/src/{main,preload}`, and
`apps/desktop/src/renderer/src/{app,launcher,plan,accounts,payees,rules,schedules,import,reports,command,components,charts,store,platform,theme}`.

Each feature folder exposes one `index.ts` and nothing else as public surface. No barrel files that
re-export everything. The facade (`BudgetDocument`) and the folder index are the API.

Co-locate `*.test.ts(x)` and `*.stories.tsx` with the code they cover. One primary export per file;
small helpers stay private. Named exports only. Around 400 lines, look for a seam; `pnpm shape` fails a
source file over 900 lines.

Components are `PascalCase.tsx`, hooks are `useCamelCase.ts`, other modules are `camelCase.ts`.

## Naming

Functions read `verbNoun`: `createTransaction`, `applyAssignments`, `coverOverspending`,
`parseQuickAdd`. Predicates read `isX`, `hasX` or `canX`: `isMonthKey`, `hasChildren`,
`canUndo`. Conversions read `toX` and `fromX`; `decodeX` returns a `Result` and `assertX` throws.

Hooks are `useX`, component props are `XProps`, tagged error types are `XxxError`.

Tests describe the unit under test and use `it("should …")` for the behaviour.

## Data and errors

Prefer plain readonly objects, discriminated unions and exhaustive `switch`.

No boolean-flag arguments. Take a small options object, or write two named functions.

`Result<T, E>` from `neverthrow` belongs at fallible boundaries: decoding a file, validating a loaded
document, parsing an import, parsing an IPC payload. Use `ok`/`err` and convert once at the seam. Throw
for programmer errors and invariants only, and never a bare `Error("…")` across a module boundary;
define a tagged error type (`BudgetFileError`, `RecordsFileError`, `AccountError`).

`zod` is the source of truth for persisted shapes: derive types with `z.infer`, never duplicate an
interface, and validate on every write.

No new dependency without a stated job and the correct package.

## Refactor on sight

| Smell                                                          | Smallest fix                           |
| -------------------------------------------------------------- | -------------------------------------- |
| A float or a `toFixed` near money                              | Parse to minor units in `money.ts`     |
| A whole-record write where two fields can change independently | Write the leaf field                   |
| A derived value stored back into the document                  | Recompute at read time                 |
| A second copy of the month math or a report series             | One pure projection, one call site     |
| A component that imports `loro-crdt`                           | Go through `BudgetDocument`            |
| A new IPC channel without a Zod parse                          | Parse in main before using the payload |
| A log line with an amount, payee, memo, or path                | Log the error code, not the content    |
| A network call                                                 | Delete it; there is no sync            |

`pnpm shape` enforces the mechanical half: file length, the single `observe` call site, Loro imports
confined to `packages/core/src/loro`, `nodeIntegration: true` banned, no float money, no network calls
in `apps/`, `node:fs` confined to main and scripts, and no logging in core.

## TypeScript

Strict mode stays on, including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax` and `isolatedModules`. Do not weaken it.

No `any` without a `// biome-ignore lint/suspicious/noExplicitAny: <reason>` and a real reason. Prefer
`unknown` with narrowing, and discriminated unions.

Type-only imports use `import type`. Imports are grouped external, `@suite/*`, then relative, separated
by blank lines; Biome's organizer enforces it.

## Domain language

A **budget** is one Loro document, one file, and one library entry. An **account** holds money; an
**on-budget** account funds the plan and an **off-budget** account is net worth only. A **category** is
an envelope; a **group** holds categories. A **month** is a `yyyy-MM` window with assignments and
activity. **Ready to Assign** is money in on-budget accounts that is not sitting in an envelope. A
**target** is a suggestion attached to a category. A **schedule** is a recurring template that becomes a
transaction when entered. A **payee** is a name. A **rule** changes fields on a matching transaction.

Say "move to Ready to Assign" and "delete transaction", not "archive" and "remove". Accounts close; a
budget is removed from the library but its file stays.

## Libraries first

Use the library's primitive before writing plumbing: Radix `Dialog`, `DropdownMenu`, `Select`; Zustand
selectors; `useSyncExternalStore`. Hand-roll only what the library leaves out, such as the month grid
geometry, the amount input, and the SVG charts.

## React

Function components with hooks, no classes.

Read document data through `useWorkspaceSnapshot` and never a `useState` copy. Never call
`BudgetDocument.observe` from a component: `store/snapshotStore.ts` owns the single subscription and
selectors stay atomic.

Keep components small and split presentational pieces into the feature folder.

## State

Zustand holds UI state only: active view, month, selected account and transaction, dialogs, notices.
Document data is owned by the Loro document.

A reconciliation lock is document data (`cleared: "reconciled"`), not a UI flag. An undo is a document
change, not a UI stack.

## Accessibility

Radix primitive first. Every icon-only control has an `aria-label` and a title. Focus stays visible;
the focus ring is defined once in `theme/styles.css`. Do not encode state in colour alone; pair the
capacity colour with a word. Respect `prefers-reduced-motion`. Storybook runs the a11y addon.

## Tests

Vitest with Testing Library. Pure modules get unit tests; components get a test where behaviour is
non-trivial and a story where it is visual. The month invariant gets a property test. Playwright covers
one Electron journey and runs on request, not in the gate.

A CRDT change gets a convergence test: two replicas from one snapshot, concurrent edits, exchange
updates, same result.

## Docs

Docs change with the code they describe. A decision that changes the shape gets an ADR; a comment may
cite `ADR-NNNN`, but the prose around it states the decision so the code does not depend on opening the
file.
