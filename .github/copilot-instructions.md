# Copilot instructions — Suite Budget

Read [AGENTS.md](../AGENTS.md) for the repo map, rules and feature path, and
[docs/reference/conventions.md](../docs/reference/conventions.md) for code shape.

## Always

- Use pnpm from the repo root; never npm or yarn.
- Document data goes through `@suite/budget-core` (`BudgetDocument`), never raw Loro.
- Zustand holds UI state only; document truth is CRDT-owned.
- Money is integer minor units. No `parseFloat` or `toFixed` outside `money.ts` and tests.
- Validate every write with Zod, and write only the leaf keys that changed.
- Keep TypeScript strict; no `any` without a justified `biome-ignore`.
- The renderer is sandboxed. New machine access goes through `BudgetBridge`, validated in main.
- The app makes no network calls. No bank sync, no updater, no telemetry.
- Conventional commit messages; docs and ADRs change with the code they describe.
- Run the local gate after each edit batch: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm shape`.
  E2E runs on request only.
- All verification gates are local. Name the local command; never claim an external CI service gates
  `main`.

## Shape

Pure core, imperative shell: schema, month math, targets, auto-assign, rules, importers, exports and
report series return data; `BudgetDocument`, the file store, recovery, IPC handlers and React hosts own
state and I/O. `neverthrow` `Result` at fallible boundaries.

## Files

Components are `PascalCase.tsx`, hooks are `useCamelCase.ts`, tests are co-located
`*.test.{ts,tsx}`, stories are `*.stories.tsx`. One `index.ts` per feature folder is its public surface.
Type-only imports use `import type`.
