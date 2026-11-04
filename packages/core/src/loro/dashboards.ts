import type { LoroDoc } from "loro-crdt";

import { createId } from "../ids";
import {
  type Dashboard,
  dashboardSchema,
  type ReportRange,
  type Widget,
  type WidgetKind,
  widgetSchema,
} from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";

export function listDashboards(doc: LoroDoc): Dashboard[] {
  return listRecords(doc, ROOTS.dashboards, dashboardSchema).sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name),
  );
}

export function listWidgets(doc: LoroDoc, dashboardId?: string): Widget[] {
  return listRecords(doc, ROOTS.widgets, widgetSchema)
    .filter((widget) => dashboardId === undefined || widget.dashboardId === dashboardId)
    .sort((left, right) => left.order - right.order);
}

export function createWidget(
  doc: LoroDoc,
  input: {
    dashboardId: string;
    kind: WidgetKind;
    range?: ReportRange;
    accountId?: string | null;
    categoryGroupId?: string | null;
    text?: string;
  },
  now: Date = new Date(),
): Widget {
  const siblings = listWidgets(doc, input.dashboardId);
  const widget = widgetSchema.parse({
    id: createId("widget"),
    dashboardId: input.dashboardId,
    kind: input.kind,
    order: siblings.length,
    range: input.range ?? "6m",
    accountId: input.accountId ?? null,
    categoryGroupId: input.categoryGroupId ?? null,
    text: input.text ?? "",
    createdAt: now.toISOString(),
  });
  insertRecord(doc, ROOTS.widgets, widgetSchema, widget);
  return widget;
}

export function updateWidget(
  doc: LoroDoc,
  id: string,
  patch: Partial<
    Pick<Widget, "kind" | "order" | "range" | "accountId" | "categoryGroupId" | "text">
  >,
): Widget {
  return updateRecord(doc, ROOTS.widgets, id, widgetSchema, patch);
}

export function deleteWidget(doc: LoroDoc, id: string): void {
  deleteRecord(doc, ROOTS.widgets, id);
}

export function moveWidget(doc: LoroDoc, id: string, direction: -1 | 1): void {
  const widget = getRecord(doc, ROOTS.widgets, id, widgetSchema);
  if (!widget) return;
  const siblings = listWidgets(doc, widget.dashboardId);
  const index = siblings.findIndex((candidate) => candidate.id === id);
  const swapWith = siblings[index + direction];
  if (index < 0 || !swapWith) return;
  updateRecord(doc, ROOTS.widgets, id, widgetSchema, { order: swapWith.order });
  updateRecord(doc, ROOTS.widgets, swapWith.id, widgetSchema, { order: widget.order });
}

export function ensureDefaultDashboard(doc: LoroDoc, now: Date = new Date()): Dashboard {
  const existing = listDashboards(doc)[0];
  if (existing) return existing;
  const dashboard = dashboardSchema.parse({
    id: createId("dash"),
    name: "Overview",
    order: 0,
    createdAt: now.toISOString(),
  });
  insertRecord(doc, ROOTS.dashboards, dashboardSchema, dashboard);
  const kinds: WidgetKind[] = [
    "ready_to_assign",
    "net_worth",
    "spending",
    "cash_flow",
    "budget_vs_actual",
  ];
  for (const kind of kinds) createWidget(doc, { dashboardId: dashboard.id, kind }, now);
  return dashboard;
}
