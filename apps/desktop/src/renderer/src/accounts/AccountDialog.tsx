import { type AccountType, parseMoney } from "@suite/budget-core";
import { Button } from "@suite/ui";
import { useEffect, useRef, useState } from "react";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

const TYPES: { id: AccountType; name: string }[] = [
  { id: "checking", name: "Checking" },
  { id: "savings", name: "Savings" },
  { id: "cash", name: "Cash" },
  { id: "credit", name: "Credit card" },
  { id: "loan", name: "Loan" },
];

export function AccountDialog() {
  const open = useUiStore((state) => state.accountDialogOpen);
  const editingId = useUiStore((state) => state.editingAccountId);
  const setAccountDialog = useUiStore((state) => state.setAccountDialog);
  const setNotice = useUiStore((state) => state.setNotice);
  const selectAccount = useUiStore((state) => state.selectAccount);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const account = editingId
    ? snapshot.accounts.find((candidate) => candidate.id === editingId)
    : undefined;

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [onBudget, setOnBudget] = useState(true);
  const [startingBalance, setStartingBalance] = useState("0.00");
  const [note, setNote] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      seeded.current = null;
      return;
    }
    const key = account?.id ?? "new";
    if (seeded.current === key) return;
    seeded.current = key;
    setName(account?.name ?? "");
    setType(account?.type ?? "checking");
    setOnBudget(account?.onBudget ?? true);
    setStartingBalance("0.00");
    setNote(account?.note ?? "");
    setCreditLimit(
      account?.creditLimitMinor
        ? String(account.creditLimitMinor / 10 ** snapshot.settings.currencyScale)
        : "",
    );
    setError(null);
  }, [open, account, snapshot.settings.currencyScale]);

  const save = (): void => {
    if (!account) {
      const parsed = parseMoney(
        startingBalance,
        snapshot.settings.currency,
        snapshot.settings.currencyScale,
      );
      if (parsed.isErr()) {
        setError(parsed.error.message);
        return;
      }
      const limit =
        creditLimit.trim().length > 0
          ? parseMoney(creditLimit, snapshot.settings.currency, snapshot.settings.currencyScale)
          : null;
      if (limit?.isErr()) {
        setError(limit.error.message);
        return;
      }
      try {
        const created = replica.document.createAccount({
          name: name.trim() || "Account",
          type,
          onBudget,
          note,
          creditLimitMinor: limit?.isOk() ? limit.value : null,
          startingBalanceMinor: parsed.value,
        });
        setAccountDialog(false);
        selectAccount(created.id);
        setNotice(`Added ${created.name}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      return;
    }

    const limit =
      creditLimit.trim().length > 0
        ? parseMoney(creditLimit, snapshot.settings.currency, snapshot.settings.currencyScale)
        : null;
    if (limit?.isErr()) {
      setError(limit.error.message);
      return;
    }
    try {
      replica.document.updateAccount(account.id, {
        name: name.trim() || account.name,
        note,
        creditLimitMinor: limit?.isOk() ? limit.value : null,
      });
      setAccountDialog(false);
      setNotice("Account updated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const toggleClosed = (): void => {
    if (!account) return;
    try {
      if (account.closedAt) {
        replica.document.reopenAccount(account.id);
        setNotice(`Reopened ${account.name}`);
      } else {
        replica.document.closeAccount(account.id);
        setNotice(`Closed ${account.name}`);
      }
      setAccountDialog(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => setAccountDialog(next)}
      title={account ? "Edit account" : "Add an account"}
      description={
        account
          ? "Type and budget membership cannot change after the account exists."
          : "A starting balance becomes the account's first transaction."
      }
      footer={
        <>
          {account ? (
            <Button variant={account.closedAt ? "secondary" : "danger"} onClick={toggleClosed}>
              {account.closedAt ? "Reopen" : "Close account"}
            </Button>
          ) : null}
          <Button onClick={() => setAccountDialog(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={name.trim().length === 0}>
            {account ? "Save" : "Add account"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <TextInput value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Type">
            <select
              value={type}
              disabled={Boolean(account)}
              onChange={(event) => {
                const next = event.target.value as AccountType;
                setType(next);
                if (next === "loan") setOnBudget(false);
              }}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink disabled:opacity-50"
            >
              {TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!account ? (
          <Field label="Starting balance" hint="Negative for a card or loan balance you owe.">
            <TextInput
              value={startingBalance}
              inputMode="decimal"
              onChange={(event) => setStartingBalance(event.target.value)}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit limit (optional)">
            <TextInput
              value={creditLimit}
              inputMode="decimal"
              onChange={(event) => setCreditLimit(event.target.value)}
              placeholder="—"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={onBudget}
              disabled={Boolean(account)}
              onChange={(event) => setOnBudget(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Count in the budget
          </label>
        </div>

        <Field label="Note">
          <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>

        {account?.closedAt ? (
          <p className="text-[12px] text-muted">
            This account is closed. Its history still counts.
          </p>
        ) : null}
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
