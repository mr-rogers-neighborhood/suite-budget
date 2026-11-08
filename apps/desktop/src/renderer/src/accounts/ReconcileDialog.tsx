import { formatMoney, parseMoney, todayKey } from "@suite/budget-core";
import { Button } from "@suite/ui";
import { useEffect, useState } from "react";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function ReconcileDialog() {
  const open = useUiStore((state) => state.reconcileOpen);
  const setOpen = useUiStore((state) => state.setReconcileOpen);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const setNotice = useUiStore((state) => state.setNotice);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();

  const account = snapshot.accounts.find((candidate) => candidate.id === selectedAccountId);
  const [date, setDate] = useState(todayKey());
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(todayKey());
    setBalance("");
    setError(null);
  }, [open]);

  if (!account) {
    return (
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Reconcile"
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <p className="text-[13px] text-muted">Choose an account first.</p>
      </Modal>
    );
  }

  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const cleared = replica.document.clearedBalance(account.id, date || todayKey());
  const parsed = parseMoney(balance || "0", currency, scale);
  const statement = parsed.isOk() ? parsed.value : 0;
  const difference = statement - cleared;
  const reconciliations = replica.document
    .listReconciliations()
    .filter((record) => record.accountId === account.id);

  const submit = (): void => {
    if (parsed.isErr()) {
      setError(parsed.error.message);
      return;
    }
    try {
      const result = replica.document.reconcileAccount({
        accountId: account.id,
        statementDate: date,
        statementBalanceMinor: parsed.value,
      });
      setNotice(
        result.adjustment
          ? `Reconciled with an adjustment of ${money(result.adjustment.amountMinor)}`
          : "Reconciled",
      );
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={`Reconcile · ${account.name}`}
      description="Enter the statement balance. Cleared rows are marked reconciled, and any difference becomes a balance adjustment."
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={balance.trim().length === 0}>
            Reconcile
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statement date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            />
          </Field>
          <Field label="Statement balance">
            <TextInput
              value={balance}
              inputMode="decimal"
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-canvas/40 p-3 text-[12px]">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">Cleared</p>
            <p className="tnum mt-1 text-ink">{money(cleared)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">Statement</p>
            <p className="tnum mt-1 text-ink">{parsed.isOk() ? money(statement) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">Difference</p>
            <p className={`tnum mt-1 ${difference === 0 ? "text-positive" : "text-warn"}`}>
              {money(difference)}
            </p>
          </div>
        </div>
        {reconciliations.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
              History
            </p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {reconciliations.map((record) => (
                <li key={record.id} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                  <span className="text-muted">{record.statementDate}</span>
                  <span className="tnum text-ink">{money(record.statementBalanceMinor)}</span>
                  <button
                    type="button"
                    className="ml-auto text-[11px] text-faint underline underline-offset-2 hover:text-ink"
                    onClick={() => {
                      replica.document.unlockReconciliation(record.id);
                      setNotice("Reconciliation unlocked");
                    }}
                  >
                    Unlock
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
