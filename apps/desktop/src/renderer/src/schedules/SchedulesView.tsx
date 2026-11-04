import {
  formatMoney,
  formatMoneyPlain,
  nextOccurrence,
  parseMoney,
  type Schedule,
  type ScheduleFrequency,
  todayKey,
  upcomingEntries,
} from "@suite/budget-core";
import { CalendarPlus, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../components/Button";
import { CategoryPicker } from "../components/CategoryPicker";
import { EmptyState } from "../components/EmptyState";
import { Field, TextInput } from "../components/Field";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

const FREQUENCIES: { id: ScheduleFrequency; name: string }[] = [
  { id: "weekly", name: "Weekly" },
  { id: "monthly", name: "Monthly" },
  { id: "yearly", name: "Yearly" },
  { id: "daily", name: "Daily" },
];

export function SchedulesView() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const setNotice = useUiStore((state) => state.setNotice);
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);

  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const accountName = (id: string) =>
    snapshot.accounts.find((account) => account.id === id)?.name ?? "—";
  const categoryName = (id: string | null) =>
    id === "rta"
      ? "Ready to Assign"
      : (snapshot.categories.find((category) => category.id === id)?.name ?? "Uncategorized");
  const upcoming = upcomingEntries(snapshot, {
    from: todayKey(),
    days: snapshot.settings.upcomingDays,
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-[16px] font-semibold text-ink">Schedules</h1>
          <p className="mt-0.5 text-[11px] text-faint">
            Upcoming entries for the next {snapshot.settings.upcomingDays} days. Nothing enters
            itself.
          </p>
        </div>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setEditing("new")}>
          <Plus size={13} />
          Add schedule
        </Button>
      </div>

      {upcoming.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Upcoming
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {upcoming.map((entry) => (
              <div
                key={`${entry.schedule.id}-${entry.date}`}
                className="flex items-center gap-3 border-b border-line/50 px-4 py-2 text-[12px] last:border-0"
              >
                <span className="w-24 text-faint">{entry.date}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {entry.schedule.payeeName || "Scheduled entry"}
                </span>
                <span className="text-muted">{accountName(entry.schedule.accountId)}</span>
                <span className="w-28 truncate text-muted">
                  {categoryName(entry.schedule.categoryId)}
                </span>
                <span
                  className={`tnum w-24 text-right ${
                    entry.schedule.amountMinor < 0 ? "text-muted" : "text-positive"
                  }`}
                >
                  {money(entry.schedule.amountMinor)}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      replica.document.enterSchedule(entry.schedule.id);
                      setNotice("Entered the scheduled transaction");
                    } catch (error) {
                      setNotice(
                        error instanceof Error ? error.message : "Could not enter the schedule",
                        "error",
                      );
                    }
                  }}
                >
                  <Play size={12} />
                  Enter
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot.schedules.length === 0 ? (
        <EmptyState
          title="No schedules yet"
          body="Add a recurring bill or paycheck. It appears as an upcoming row; one click enters it."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              <CalendarPlus size={14} />
              Add schedule
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="grid grid-cols-[110px_1.3fr_1fr_1fr_110px_120px_60px] border-b border-line bg-panel/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            <span>Next</span>
            <span>Payee</span>
            <span>Account</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
            <span>Repeat</span>
            <span />
          </div>
          {snapshot.schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="grid grid-cols-[110px_1.3fr_1fr_1fr_110px_120px_60px] items-center border-b border-line/50 px-4 py-2 text-[12px] last:border-0 hover:bg-raised/40"
            >
              <span className="text-faint">{schedule.nextDate}</span>
              <button
                type="button"
                onClick={() => setEditing(schedule)}
                className="truncate text-left text-ink hover:underline"
              >
                {schedule.payeeName || "—"}
              </button>
              <span className="truncate text-muted">{accountName(schedule.accountId)}</span>
              <span className="truncate text-muted">{categoryName(schedule.categoryId)}</span>
              <span className="tnum text-right text-ink">{money(schedule.amountMinor)}</span>
              <span className="text-faint">
                {FREQUENCIES.find((item) => item.id === schedule.frequency)?.name}
                {schedule.interval > 1 ? ` ×${schedule.interval}` : ""}
              </span>
              <span className="flex justify-end">
                <IconButton
                  label={`Delete ${schedule.payeeName || "schedule"}`}
                  icon={<Trash2 size={13} />}
                  onClick={() => {
                    replica.document.deleteSchedule(schedule.id);
                    setNotice("Schedule deleted");
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      <ScheduleDialog
        schedule={editing}
        onClose={() => setEditing(null)}
        onError={(message) => setNotice(message, "error")}
      />
    </div>
  );
}

function ScheduleDialog({
  schedule,
  onClose,
  onError,
}: {
  schedule: Schedule | "new" | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const isNew = schedule === "new";
  const record = schedule && schedule !== "new" ? schedule : undefined;
  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const [accountId, setAccountId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"outflow" | "inflow">("outflow");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("monthly");
  const [interval, setInterval] = useState(1);
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [endDate, setEndDate] = useState("");
  const [memo, setMemo] = useState("");
  const seeded = useRef<string | null>(null);

  const currentKey = record?.id ?? (isNew ? "new" : null);
  useEffect(() => {
    if (!schedule) {
      seeded.current = null;
      return;
    }
    if (seeded.current === currentKey) return;
    seeded.current = currentKey;
    setAccountId(
      record?.accountId ??
        snapshot.accounts.find((account) => account.onBudget && !account.closedAt)?.id ??
        "",
    );
    setPayeeName(record?.payeeName ?? "");
    setCategoryId(record?.categoryId ?? null);
    setDirection((record?.amountMinor ?? -1) < 0 ? "outflow" : "inflow");
    setAmount(record ? formatMoneyPlain(Math.abs(record.amountMinor), scale) : "");
    setFrequency(record?.frequency ?? "monthly");
    setInterval(record?.interval ?? 1);
    setAnchorDate(record?.anchorDate ?? todayKey());
    setEndDate(record?.endDate ?? "");
    setMemo(record?.memo ?? "");
  }, [schedule, currentKey, record, scale, snapshot.accounts]);

  if (!schedule) return null;

  const save = (): void => {
    const parsed = parseMoney(amount, currency, scale);
    if (parsed.isErr() || parsed.value === 0) {
      onError("Enter an amount");
      return;
    }
    if (!accountId) {
      onError("Choose an account");
      return;
    }
    const signed = direction === "outflow" ? -Math.abs(parsed.value) : Math.abs(parsed.value);
    let nextDate = anchorDate;
    let guard = 0;
    while (nextDate < todayKey() && guard < 1000) {
      nextDate = nextOccurrence(nextDate, frequency, interval, anchorDate);
      guard += 1;
    }
    try {
      if (isNew) {
        replica.document.createSchedule({
          accountId,
          payeeName,
          categoryId,
          amountMinor: signed,
          memo,
          frequency,
          interval,
          anchorDate,
          endDate: endDate || null,
        });
      } else if (record) {
        replica.document.updateSchedule(record.id, {
          accountId,
          payeeName,
          categoryId,
          amountMinor: signed,
          memo,
          frequency,
          interval,
          anchorDate,
          nextDate,
          endDate: endDate || null,
        });
      }
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save the schedule");
    }
  };

  return (
    <Modal
      open={schedule !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isNew ? "Add schedule" : "Edit schedule"}
      description="The next date keeps the anchor day, so the 31st clamps in short months."
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save schedule
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account">
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              {snapshot.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payee">
            <TextInput value={payeeName} onChange={(event) => setPayeeName(event.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_120px_140px] gap-3">
          <Field label="Category">
            <CategoryPicker
              value={categoryId}
              onChange={setCategoryId}
              categories={snapshot.categories}
              groups={snapshot.categoryGroups}
              includeReadyToAssign
              ariaLabel="Schedule category"
            />
          </Field>
          <Field label="Direction">
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as "outflow" | "inflow")}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              <option value="outflow">Outflow</option>
              <option value="inflow">Inflow</option>
            </select>
          </Field>
          <Field label="Amount">
            <TextInput
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Repeats">
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as ScheduleFrequency)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              {FREQUENCIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Every">
            <TextInput
              type="number"
              min={1}
              value={interval}
              onChange={(event) => setInterval(Math.max(1, Number(event.target.value) || 1))}
            />
          </Field>
          <Field label="First date">
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            />
          </Field>
          <Field label="Ends (optional)">
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            />
          </Field>
        </div>
        <Field label="Memo">
          <TextInput value={memo} onChange={(event) => setMemo(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
