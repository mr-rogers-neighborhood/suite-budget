# ADR-0016: Hand-rolled SVG charts, pure series in core

- Status: accepted
- Date: 2026-01-05

## Context

Six reports and a dashboard do not justify a charting framework, its theming system, and its bundle. The
shapes are lines, grouped bars, and horizontal bars.

## Decision

Report series are pure functions in `packages/core/src/reports`. Two small SVG components render lines
and grouped bars; a bar list renders rankings. Every chart has an accessible name and a data table. No
chart dependency.

## Consequences

- The visuals use the same tokens as the rest of the app.
- Series can be unit-tested without a DOM.
- Interaction is limited to hover titles; a richer chart can be added behind the same series API.
