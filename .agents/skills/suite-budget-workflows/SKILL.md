---

name: suite-budget-workflows
description: >-
Development runbooks and verification harnesses for Suite Budget. Use when running checks, tests,
verification gates, or when adhering to Suite Budget's local-first architecture, money rules, and
file-safety conventions.
---

# Suite Budget workflows

## 1. The verification gate

The gate is local. There is no CI and no scratchpad in this repo.

- **Edit loop:** `pnpm check`
  - Biome, `tsc` across the workspace, `vitest run --changed`, and the shape check.
- **Full gate:** `pnpm verify`
  - The edit loop plus all tests, `knip`, the production build, and the Storybook build.
- **Shape rules:** `node scripts/check-shape.mjs`
  - File length, one `observe` call site, Loro confinement, no float money, no network calls, `fs`
    only in main, no `console.log` in core.
- **Electron smoke:** `pnpm build && pnpm e2e:smoke`
  - On request only. The journey launches the built app. In a headless environment use
    `xvfb-run -a pnpm e2e:smoke`.

## 2. Architectural invariants

1. **One writer.** Document data goes through `BudgetDocument` in `@suite/budget-core`. Never write raw
   Loro, and never import `loro-crdt` outside `packages/core/src/loro`.
2. **State separation.** Document truth is Loro; UI state is Zustand; transient view state is React.
3. **Money is integers.** Amounts are signed minor units. `money.ts` owns parsing and formatting;
   `parseFloat` and `toFixed` are banned elsewhere.
4. **Pure core.** Schema, month math, targets, auto-assign, rules, importers, exports and report series
   take data and return data. No DOM, no Loro, no `fs`, no `fetch`, no timers.
5. **Fallible boundaries.** Use `neverthrow` `Result` for file decode, record validation and IPC parse.
6. **File safety.** A damaged budget is never overwritten. Try backups, then recovery mode, then let
   the user decide.
7. **No network.** No bank sync, no analytics, no updater, no remote content.

## 3. The month invariant

The one test that matters most:

```
sum(available for every category) + readyToAssign = onBudgetBalance
```

The property test in `packages/core/src/plan/invariant.test.ts` generates documents and fails on drift.
A change to month math must keep it green and add a hand-computed fixture for the new case.

## 4. Adding a feature

1. Schema and types in `packages/core/src/schema.ts` with tests.
2. A typed accessor or mutation on `BudgetDocument`.
3. Consume it through `useWorkspaceSnapshot` and the Zustand store.
4. A story where it is visual, a test where behaviour is non-trivial.
5. Update `docs/reference` and add an ADR if the shape changes.
6. Run `pnpm verify`.
