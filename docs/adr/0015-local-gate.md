# ADR-0015: Local gate only; no CI

- Status: accepted
- Date: 2026-01-05

## Context

The Suite projects run their gates locally: Biome, `tsc`, Vitest, the shape check, the build. A CI
service adds a second source of truth and a claim about `main` that can drift from what a contributor
actually ran.

## Decision

No CI. `pnpm check` is the edit loop and `pnpm verify` is the full gate. Playwright is a milestone action
the owner requests, not a per-change gate. Every gate claim names a local command.

## Consequences

- A contributor can reproduce the gate exactly on their machine.
- Nothing merges on a green check that nobody can run.
- A headless environment runs the Electron smoke under `xvfb-run`.
