import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ageOfMoney,
  budgetVsActual,
  cashFlowSeries,
  incomeExpenseSeries,
  monthKeyOfDate,
  monthLabel,
  monthState,
  monthsForRange,
  netWorthSeries,
  type ReportRange,
  spendingByCategory,
  type Widget,
  type WidgetKind,
} from "@suite/budget-core";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BarChart, BarList, LineChart, moneyFormatter, monthLabels, Stat } from "../charts/Charts";
import { Button } from "../components/Button";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

type ReportKind =
  | "dashboard"
  | "net_worth"
  | "spending"
  | "income_expense"
  | "cash_flow"
  | "budget_actual"
  | "age";

const TABS: { id: ReportKind; name: string }[] = [
  { id: "dashboard", name: "Dashboard" },
  { id: "net_worth", name: "Net worth" },
  { id: "spending", name: "Spending" },
  { id: "income_expense", name: "Income vs expense" },
  { id: "cash_flow", name: "Cash flow" },
  { id: "budget_actual", name: "Budget vs actual" },
  { id: "age", name: "Age of money" },
];

const RANGES: { id: ReportRange; name: string }[] = [
  { id: "1m", name: "This month" },
  { id: "3m", name: "Last 3 months" },
  { id: "6m", name: "Last 6 months" },
  { id: "12m", name: "Last 12 months" },
  { id: "ytd", name: "Year to date" },
  { id: "all", name: "All time" },
];

export function ReportsView() {
  const snapshot = useWorkspaceSnapshot();
  const [kind, setKind] = useState<ReportKind>("dashboard");
  const [range, setRange] = useState<ReportRange>("6m");
  const months = useMemo(() => monthsForRange(snapshot, range, new Date()), [snapshot, range]);
  const money = moneyFormatter(snapshot.settings.currency, snapshot.settings.currencyScale);
  const month = useUiStore((state) => state.month);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-[16px] font-semibold text-ink">Reports</h1>
          <p className="mt-0.5 text-[11px] text-faint">
            Every number is rebuilt from the ledger; nothing is stored twice.
          </p>
        </div>
        <select
          value={range}
          onChange={(event) => setRange(event.target.value as ReportRange)}
          aria-label="Report range"
          className="ml-auto h-7 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
        >
          {RANGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-line pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setKind(tab.id)}
            className={
              kind === tab.id
                ? "rounded-md bg-accent-soft px-3 py-1.5 text-[12px] font-medium text-ink"
                : "rounded-md px-3 py-1.5 text-[12px] text-muted hover:bg-raised hover:text-ink"
            }
          >
            {tab.name}
          </button>
        ))}
      </div>

      {kind === "dashboard" ? <DashboardGrid /> : null}
      {kind === "net_worth" ? <NetWorth months={months} money={money} /> : null}
      {kind === "spending" ? <Spending months={months} money={money} /> : null}
      {kind === "income_expense" ? <IncomeExpense months={months} money={money} /> : null}
      {kind === "cash_flow" ? <CashFlow months={months} money={money} /> : null}
      {kind === "budget_actual" ? <BudgetActual month={month} money={money} /> : null}
      {kind === "age" ? <AgeOfMoney months={months} /> : null}
    </div>
  );
}

function NetWorth({ months, money }: { months: string[]; money: (value: number) => string }) {
  const snapshot = useWorkspaceSnapshot();
  const points = netWorthSeries(snapshot, months);
  const latest = points[points.length - 1]?.valueMinor ?? 0;
  const first = points[0]?.valueMinor ?? 0;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Net worth" value={money(latest)} hint={`${points.length} month window`} />
        <Stat label="Change" value={money(latest - first)} hint="Across this range" />
        <Stat
          label="Accounts"
          value={String(snapshot.accounts.filter((account) => !account.closedAt).length)}
          hint="On and off budget"
        />
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">
        <LineChart
          points={points.map((point) => ({
            label: monthLabel(point.month).slice(0, 3),
            value: point.valueMinor,
          }))}
          format={money}
          ariaLabel="Net worth over time"
        />
      </div>
    </div>
  );
}

function Spending({ months, money }: { months: string[]; money: (value: number) => string }) {
  const snapshot = useWorkspaceSnapshot();
  const rows = spendingByCategory(snapshot, months);
  const total = rows.reduce((sum, row) => sum + row.spentMinor, 0);
  return (
    <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
      <div className="rounded-xl border border-line bg-panel p-4">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">Spending by category</h2>
        <BarList
          rows={rows.slice(0, 12).map((row) => ({
            label: row.categoryName,
            value: row.spentMinor,
            meta: row.groupName,
          }))}
          format={money}
        />
      </div>
      <div className="grid gap-3">
        <Stat label="Total spending" value={money(total)} hint="Net of refunds" />
        <Stat label="Categories" value={String(rows.length)} hint="With spending in this range" />
        {rows.length > 0 ? (
          <Stat
            label="Largest"
            value={rows[0]?.categoryName ?? "—"}
            hint={money(rows[0]?.spentMinor ?? 0)}
          />
        ) : null}
      </div>
    </div>
  );
}

function IncomeExpense({ months, money }: { months: string[]; money: (value: number) => string }) {
  const snapshot = useWorkspaceSnapshot();
  const series = incomeExpenseSeries(snapshot, months);
  const income = series.reduce((sum, point) => sum + point.incomeMinor, 0);
  const expense = series.reduce((sum, point) => sum + point.expenseMinor, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Income" value={money(income)} />
        <Stat label="Expense" value={money(expense)} />
        <Stat label="Net" value={money(income - expense)} />
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">
        <BarChart
          labels={monthLabels(months)}
          series={[
            {
              label: "Income",
              color: "var(--chart-1)",
              values: series.map((point) => point.incomeMinor),
            },
            {
              label: "Expense",
              color: "var(--chart-2)",
              values: series.map((point) => point.expenseMinor),
            },
          ]}
          format={money}
          ariaLabel="Income and expense by month"
        />
      </div>
    </div>
  );
}

function CashFlow({ months, money }: { months: string[]; money: (value: number) => string }) {
  const snapshot = useWorkspaceSnapshot();
  const series = cashFlowSeries(snapshot, months);
  const latest = series[series.length - 1]?.balanceMinor ?? 0;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="On-budget balance" value={money(latest)} hint="End of the latest month" />
        <Stat
          label="Months shown"
          value={String(months.length)}
          hint="Cash flow counts on-budget accounts only"
        />
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">
        <LineChart
          points={series.map((point) => ({
            label: monthLabel(point.month).slice(0, 3),
            value: point.balanceMinor,
          }))}
          format={money}
          color="var(--chart-5)"
          ariaLabel="On-budget cash balance over time"
        />
      </div>
    </div>
  );
}

function BudgetActual({ month, money }: { month: string; money: (value: number) => string }) {
  const snapshot = useWorkspaceSnapshot();
  const rows = budgetVsActual(snapshot, month);
  const assigned = rows.reduce((sum, row) => sum + row.assignedMinor, 0);
  const activity = rows.reduce((sum, row) => sum + row.activityMinor, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Month" value={monthLabel(month)} />
        <Stat label="Assigned" value={money(assigned)} />
        <Stat label="Activity" value={money(activity)} />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-line bg-panel/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
          <span>Category</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Available</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.categoryId}
            className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-line/50 px-4 py-1.5 text-[12px] last:border-0"
          >
            <span className="truncate text-ink">
              {row.categoryName}
              <span className="ml-2 text-[10px] text-faint">{row.groupName}</span>
            </span>
            <span className="tnum text-right text-muted">{money(row.assignedMinor)}</span>
            <span className="tnum text-right text-muted">{money(row.activityMinor)}</span>
            <span
              className={`tnum text-right ${row.availableMinor < 0 ? "text-negative" : "text-ink"}`}
            >
              {money(row.availableMinor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgeOfMoney({ months }: { months: string[] }) {
  const snapshot = useWorkspaceSnapshot();
  const report = ageOfMoney(snapshot, months);
  const points = report.points
    .filter((point) => point.days !== null)
    .map((point) => ({ label: monthLabel(point.month).slice(0, 3), value: point.days ?? 0 }));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Age of money"
          value={report.averageDays === null ? "—" : `${report.averageDays} days`}
          hint="Weighted average of the last ten outflows"
        />
        <Stat
          label="Outflows measured"
          value={String(report.lastOutflows.length)}
          hint="FIFO over income to Ready to Assign"
        />
      </div>
      <div className="rounded-xl border border-line bg-panel p-4">
        {points.length > 0 ? (
          <LineChart
            points={points}
            format={(value) => `${Math.round(value)} days`}
            color="var(--chart-4)"
            ariaLabel="Age of money by month"
          />
        ) : (
          <p className="text-[12px] text-faint">
            Add income and spending to see how old the money you spend is.
          </p>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        Age of money is a rough lens, not a score. It follows the order dollars enter the budget and
        leave it.
      </p>
    </div>
  );
}

function DashboardGrid() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const money = moneyFormatter(snapshot.settings.currency, snapshot.settings.currencyScale);
  const dashboard = snapshot.dashboards[0];

  useEffect(() => {
    if (!dashboard) replica.document.ensureDefaultDashboard();
  }, [dashboard, replica]);

  if (!dashboard) {
    return <p className="text-[12px] text-faint">Preparing the dashboard…</p>;
  }

  const widgets = snapshot.widgets
    .filter((widget) => widget.dashboardId === dashboard.id)
    .sort((left, right) => left.order - right.order);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-ink">{dashboard.name}</h2>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" className="ml-auto">
              <Plus size={13} />
              Add widget
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-xl"
            >
              {(
                [
                  "ready_to_assign",
                  "net_worth",
                  "spending",
                  "income_expense",
                  "cash_flow",
                  "budget_vs_actual",
                  "age_of_money",
                  "text",
                ] as WidgetKind[]
              ).map((kind) => (
                <DropdownMenu.Item
                  key={kind}
                  onSelect={() =>
                    replica.document.createWidget({ dashboardId: dashboard.id, kind })
                  }
                  className="cursor-default select-none rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-raised"
                >
                  {kind.replaceAll("_", " ")}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {widgets.map((widget, index) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            money={money}
            canMoveUp={index > 0}
            canMoveDown={index < widgets.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function WidgetCard({
  widget,
  money,
  canMoveUp,
  canMoveDown,
}: {
  widget: Widget;
  money: (value: number) => string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const months = useMemo(
    () => monthsForRange(snapshot, widget.range, new Date()),
    [snapshot, widget.range],
  );
  const month = monthKeyOfDate(new Date());

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
          {widget.kind.replaceAll("_", " ")}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          {widget.kind !== "ready_to_assign" && widget.kind !== "text" ? (
            <select
              value={widget.range}
              onChange={(event) =>
                replica.document.updateWidget(widget.id, {
                  range: event.target.value as ReportRange,
                })
              }
              aria-label="Widget range"
              className="h-6 rounded border border-line bg-raised px-1 text-[10px] text-muted"
            >
              {RANGES.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            aria-label="Move up"
            disabled={!canMoveUp}
            onClick={() => replica.document.moveWidget(widget.id, -1)}
            className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-30"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={!canMoveDown}
            onClick={() => replica.document.moveWidget(widget.id, 1)}
            className="rounded p-0.5 text-faint hover:text-ink disabled:opacity-30"
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            aria-label="Remove widget"
            onClick={() => replica.document.deleteWidget(widget.id)}
            className="rounded p-0.5 text-faint hover:text-danger"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <WidgetBody widget={widget} months={months} month={month} money={money} />
    </section>
  );
}

function WidgetBody({
  widget,
  months,
  month,
  money,
}: {
  widget: Widget;
  months: string[];
  month: string;
  money: (value: number) => string;
}) {
  const snapshot = useWorkspaceSnapshot();

  if (widget.kind === "ready_to_assign") {
    const state = monthState(snapshot, month);
    return (
      <div>
        <p
          className={`tnum text-[26px] font-semibold ${state.readyToAssignMinor < 0 ? "text-negative" : "text-ink"}`}
        >
          {money(state.readyToAssignMinor)}
        </p>
        <p className="mt-1 text-[11px] text-faint">
          {money(state.assignedMinor)} assigned this month · {money(state.availableMinor)} in
          envelopes
        </p>
      </div>
    );
  }
  if (widget.kind === "net_worth") {
    const points = netWorthSeries(snapshot, months);
    return (
      <LineChart
        points={points.map((point) => ({
          label: monthLabel(point.month).slice(0, 3),
          value: point.valueMinor,
        }))}
        format={money}
        height={150}
        ariaLabel="Net worth"
      />
    );
  }
  if (widget.kind === "spending") {
    const rows = spendingByCategory(snapshot, months);
    return (
      <BarList
        rows={rows.slice(0, 5).map((row) => ({ label: row.categoryName, value: row.spentMinor }))}
        format={money}
      />
    );
  }
  if (widget.kind === "income_expense") {
    const series = incomeExpenseSeries(snapshot, months);
    return (
      <BarChart
        labels={monthLabels(months)}
        series={[
          {
            label: "Income",
            color: "var(--chart-1)",
            values: series.map((point) => point.incomeMinor),
          },
          {
            label: "Expense",
            color: "var(--chart-2)",
            values: series.map((point) => point.expenseMinor),
          },
        ]}
        format={money}
        height={150}
        ariaLabel="Income and expense"
      />
    );
  }
  if (widget.kind === "cash_flow") {
    const series = cashFlowSeries(snapshot, months);
    return (
      <LineChart
        points={series.map((point) => ({
          label: monthLabel(point.month).slice(0, 3),
          value: point.balanceMinor,
        }))}
        format={money}
        color="var(--chart-5)"
        height={150}
        ariaLabel="Cash flow"
      />
    );
  }
  if (widget.kind === "budget_vs_actual") {
    const rows = budgetVsActual(snapshot, month).slice(0, 6);
    return (
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.categoryId} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="truncate text-ink">{row.categoryName}</span>
            <span className="tnum shrink-0 text-muted">
              {money(row.activityMinor)} / {money(row.assignedMinor)}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (widget.kind === "age_of_money") {
    const report = ageOfMoney(snapshot, months);
    return (
      <p className="tnum text-[26px] font-semibold text-ink">
        {report.averageDays === null ? "—" : `${report.averageDays} days`}
      </p>
    );
  }
  return (
    <p className="text-[12px] leading-relaxed text-muted">{widget.text || "A note widget."}</p>
  );
}
