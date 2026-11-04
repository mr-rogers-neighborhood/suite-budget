# AGENTS.md

Suite Budget is a local-first envelope budget: Electron, React 19, one Loro CRDT document per budget,
Zod-validated records, Tailwind v4 with Radix primitives. This file is the entry point for AI agents and
the short version for humans.

Read [docs/reference/conventions.md](docs/reference/conventions.md) before writing code and
[docs/reference/architecture.md](docs/reference/architecture.md) before changing the document layer.

## Stack

- pnpm workspaces, no Turborepo.
- Desktop: Electron + electron-vite, React 19, TypeScript strict, Tailwind CSS v4, Radix primitives,
  Zustand for UI state.
- Document: Loro CRDT, Zod schema, `BudgetDocument` as the only writer.
- Quality: Biome, Vitest + Testing Library, Storybook with a11y, Playwright for one Electron smoke.

## Repo map

| Path                            | Purpose                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `apps/desktop/src/main`         | Document authority, library, atomic file store, backups, recovery, IPC, menu |
| `apps/desktop/src/preload`      | The allowlisted `contextBridge` surface                                      |
| `apps/desktop/src/renderer/src` | React app: launcher, plan, accounts, reports, rules, schedules, payees       |
| `packages/core`                 | Schema, document layer, pure projections, importers, exports, reports        |
| `docs/reference`                | Architecture, conventions, data model, interface                             |
| `docs/adr`                      | Our decision records; ADR ids are stable and quotable                        |

## Commands

```sh
pnpm install
pnpm dev          # Electron + Vite renderer
pnpm check        # biome, tsc, vitest --changed, shape
pnpm verify       # lint, typecheck, all tests, shape, knip, build, Storybook build
pnpm test         # every Vitest project
pnpm storybook    # component workshop
pnpm e2e:smoke    # Playwright Electron journey, on request only
pnpm package      # electron-builder for this platform
```

## Verify

The gate is local and runs on every change:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm shape
```

`pnpm check` is the edit loop: Biome, `tsc` across the workspace, `vitest run --changed`, and the shape
check. `pnpm verify` adds `knip`, the production build, and the Storybook build.

Playwright sits outside both. Run `pnpm build` first: the journey launches the built app. Run
`pnpm e2e:smoke` when the owner asks for it or names a milestone; no change waits on it. In a headless
environment, run it under `xvfb-run -a`.

All verification gates are local. Every gate claim names a local command.

## Rules

1. Document data goes through `@suite/budget-core` (`BudgetDocument`). Never touch Loro from a
   component, and never import `loro-crdt` outside `packages/core/src/loro`.
2. Document truth never lives in Zustand, React state, or localStorage. Zustand holds UI state only.
3. Validate every write with the Zod schema. A write sets the leaf keys that changed, never the whole
   record.
4. Money is integer minor units. `parseFloat` and `toFixed` are banned outside `money.ts` and tests.
5. TypeScript stays strict. No `any` without a justified `biome-ignore`; prefer `unknown` and narrowing.
6. The renderer talks to the machine only through `BudgetBridge`; every IPC payload is validated in
   main.
7. The renderer is sandboxed: `contextIsolation`, `sandbox`, no `nodeIntegration`, no remote content.
8. Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
9. No new dependency without a stated job and the right package.
10. Docs change with the code they describe. A decision that changes the shape gets an ADR.
11. Keep the renderer accessible: Radix primitive first, labelled controls, visible focus, no
    colour-only state.
12. There is no bank sync, ever. Do not add a network client, an updater, or an analytics call.

## Code shape

Pure core, imperative shell. Schema, month math, targets, auto-assign, rules, importers, exports and
report series take data and return data: no DOM, no Loro, no `fs`, no `fetch`, no timers.
`BudgetDocument`, the file store, recovery, IPC handlers and React hosts own state and I/O. Dependencies
point inward.

One owner per piece of state: document truth in Loro through `BudgetDocument`, UI state in Zustand,
transient view state in React.

`neverthrow` `Result` belongs at fallible boundaries: file decode, record validation, IPC parsing.

## Feature path

1. Model it in `packages/core/src/schema.ts` with tests.
2. Add a typed accessor or mutation on `BudgetDocument`.
3. Consume it through `useWorkspaceSnapshot` and the Zustand store.
4. Add a story where it is visual, a test where behaviour is non-trivial.
5. Update the reference docs and run `pnpm check`.

## Definition of done

Schema and types in `@suite/budget-core` with unit tests; a component test or story where the change is
visible; docs updated in the same change; `pnpm verify` green; no new `any`, no raw Loro writes, no
float money, no document state in the UI store, no network call.

## Tools for the session

`.mcp.json` and `.vscode/mcp.json` are empty on purpose. Add a server only for a task that needs it, and
name its tools explicitly. Never use `"*"`: an unlisted surface costs context and hides which tools
actually ran.

## Decision records

`docs/adr/` holds our own records, starting at ADR-0001. They are written for Suite Budget; none are
copied from another project. A comment may cite `ADR-NNNN`, and the surrounding prose should still state
the decision so the code does not depend on opening the file.
