import type { LoroDoc } from "loro-crdt";

import { type DateKey, todayKey } from "../dates";
import { createId } from "../ids";
import { nextOccurrence } from "../recurrence";
import {
  type Schedule,
  type ScheduleFrequency,
  scheduleSchema,
  type TransactionFlag,
} from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";
import { createTransaction } from "./transactions";

export type NewScheduleInput = {
  accountId: string;
  payeeId?: string | null;
  payeeName?: string;
  categoryId?: string | null;
  amountMinor: number;
  memo?: string;
  flag?: TransactionFlag | null;
  frequency: ScheduleFrequency;
  interval?: number;
  anchorDate?: DateKey;
  endDate?: DateKey | null;
};

export class ScheduleError extends Error {
  constructor(
    readonly code: "not-found" | "ended",
    message: string,
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

export function listSchedules(doc: LoroDoc): Schedule[] {
  return listRecords(doc, ROOTS.schedules, scheduleSchema).sort((left, right) =>
    left.nextDate.localeCompare(right.nextDate),
  );
}

function getSchedule(doc: LoroDoc, id: string): Schedule | undefined {
  return getRecord(doc, ROOTS.schedules, id, scheduleSchema);
}

function requireSchedule(doc: LoroDoc, id: string): Schedule {
  const schedule = getSchedule(doc, id);
  if (!schedule) throw new ScheduleError("not-found", `Schedule ${id} does not exist`);
  return schedule;
}

export function createSchedule(
  doc: LoroDoc,
  input: NewScheduleInput,
  now: Date = new Date(),
): Schedule {
  const anchorDate = input.anchorDate ?? todayKey(now);
  const interval = input.interval ?? 1;
  let nextDate = anchorDate;
  while (nextDate < todayKey(now)) {
    nextDate = nextOccurrence(nextDate, input.frequency, interval, anchorDate);
  }
  const timestamp = now.toISOString();
  const schedule = scheduleSchema.parse({
    id: createId("sched"),
    accountId: input.accountId,
    payeeId: input.payeeId ?? null,
    payeeName: input.payeeName ?? "",
    categoryId: input.categoryId ?? null,
    amountMinor: input.amountMinor,
    memo: input.memo ?? "",
    flag: input.flag ?? null,
    frequency: input.frequency,
    interval,
    anchorDate,
    nextDate,
    endDate: input.endDate ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.schedules, scheduleSchema, schedule);
  return schedule;
}

export function updateSchedule(
  doc: LoroDoc,
  id: string,
  patch: Partial<Omit<Schedule, "id" | "createdAt" | "updatedAt">>,
  now: Date = new Date(),
): Schedule {
  return updateRecord(doc, ROOTS.schedules, id, scheduleSchema, patch, {
    key: "updatedAt",
    value: now.toISOString(),
  });
}

export function deleteSchedule(doc: LoroDoc, id: string): void {
  deleteRecord(doc, ROOTS.schedules, id);
}

export function enterSchedule(
  doc: LoroDoc,
  id: string,
  now: Date = new Date(),
): { schedule: Schedule; transactionId: string } {
  const schedule = requireSchedule(doc, id);
  const transaction = createTransaction(
    doc,
    {
      accountId: schedule.accountId,
      date: schedule.nextDate,
      amountMinor: schedule.amountMinor,
      payeeId: schedule.payeeId,
      payeeName: schedule.payeeName,
      categoryId: schedule.categoryId,
      memo: schedule.memo,
      cleared: "uncleared",
      flag: schedule.flag,
      scheduledId: schedule.id,
    },
    now,
  );
  const nextDate = nextOccurrence(
    schedule.nextDate,
    schedule.frequency,
    schedule.interval,
    schedule.anchorDate,
  );
  const updated = updateRecord(doc, ROOTS.schedules, id, scheduleSchema, {
    nextDate,
    updatedAt: now.toISOString(),
  });
  return { schedule: updated, transactionId: transaction.id };
}
