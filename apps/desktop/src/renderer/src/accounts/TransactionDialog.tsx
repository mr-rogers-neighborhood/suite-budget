import {
  type ClearedStatus,
  formatMoney,
  formatMoneyPlain,
  parseMoney,
  type TransactionFlag,
  todayKey,
} from "@suite/budget-core";
import { Button } from "@suite/ui";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategoryPicker } from "../components/CategoryPicker";
import { Field, TextInput } from "../components/Field";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

type SplitRow = {
  key: string;
  categoryId: string | null;
  amount: string;
  direction: "outflow" | "inflow";
  memo: string;
};

const FLAGS: { id: TransactionFlag | ""; name: string }[] = [
  { id: "", name: "No flag" },
  { id: "red", name: "Red" },
  { id: "orange", name: "Orange" },
  { id: "yellow", name: "Yellow" },
  { id: "green", name: "Green" },
  { id: "blue", name: "Blue" },
  { id: "purple", name: "Purple" },
];

export function TransactionDialog() {
  const open = useUiStore((state) => state.newTransactionOpen);
  const transactionId = useUiStore((state) => state.selectedTransactionId);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const setNotice = useUiStore((state) => state.setNotice);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();

  const existing = transactionId
    ? snapshot.transactions.find((transaction) => transaction.id === transactionId)
    : undefined;
  const locked = existing?.cleared === "reconciled";
  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);

  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [payeeName, setPayeeName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"outflow" | "inflow">("outflow");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [flag, setFlag] = useState<TransactionFlag | "">("");
  const [cleared, setCleared] = useState<ClearedStatus>("uncleared");
  const [transferAccountId, setTransferAccountId] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef<string | null>(null);

  useEffect(() => {
    const seedKey = `${open}:${transactionId ?? "new"}`;
    if (!open) {
      seeded.current = null;
      return;
    }
    if (seeded.current === seedKey) return;
    seeded.current = seedKey;
    setError(null);
    if (existing) {
      const kids = snapshot.transactions.filter(
        (transaction) => transaction.parentId === existing.id,
      );
      setAccountId(existing.accountId);
      setDate(existing.date);
      setPayeeName(existing.payeeName);
      setCategoryId(existing.categoryId);
      setDirection(existing.amountMinor < 0 ? "outflow" : "inflow");
      setAmount(formatMoneyPlain(Math.abs(existing.amountMinor), scale));
      setMemo(existing.memo);
      setFlag(existing.flag ?? "");
      setCleared(existing.cleared);
      setTransferAccountId(existing.transferAccountId ?? "");
      setSplitMode(kids.length > 0);
      setSplitRows(
        kids.length > 0
          ? kids.map((child) => ({
              key: child.id,
              categoryId: child.categoryId,
              amount: formatMoneyPlain(Math.abs(child.amountMinor), scale),
              direction: child.amountMinor < 0 ? "outflow" : "inflow",
              memo: child.memo,
            }))
          : [blankRow(), blankRow()],
      );
    } else {
      setAccountId(
        selectedAccountId ??
          snapshot.accounts.find((account) => account.onBudget && !account.closedAt)?.id ??
          snapshot.accounts[0]?.id ??
          "",
      );
      setDate(todayKey());
      setPayeeName("");
      setCategoryId(null);
      setDirection("outflow");
      setAmount("");
      setMemo("");
      setFlag("");
      setCleared("uncleared");
      setTransferAccountId("");
      setSplitMode(false);
      setSplitRows([blankRow(), blankRow()]);
    }
  }, [open, transactionId, existing, snapshot, scale, selectedAccountId]);

  const close = (): void => {
    useUiStore.getState().setNewTransactionOpen(false);
    useUiStore.getState().selectTransaction(null);
  };

  const isTransfer = Boolean(existing?.transferId) || transferAccountId.length > 0;
  const account = snapshot.accounts.find((candidate) => candidate.id === accountId);
  const targetAccount = snapshot.accounts.find((candidate) => candidate.id === transferAccountId);
  const transferNeedsCategory =
    isTransfer &&
    Boolean(account) &&
    Boolean(targetAccount) &&
    account?.onBudget !== targetAccount?.onBudget;

  const splitTotal = splitRows.reduce((total, row) => {
    const parsed = parseMoney(row.amount || "0", currency, scale);
    if (parsed.isErr()) return total;
    return total + (row.direction === "outflow" ? -Math.abs(parsed.value) : Math.abs(parsed.value));
  }, 0);

  const save = (): void => {
    if (!accountId) {
      setError("Choose an account");
      return;
    }
    if (!account) {
      setError("Choose an account");
      return;
    }
    try {
      if (splitMode) {
        if (existing?.parentId) {
          setError("A split line cannot itself be split");
          return;
        }
        if (existing?.transferId) {
          setError("A transfer cannot be split");
          return;
        }
        const splits = splitRows.map((row) => {
          const parsed = parseMoney(row.amount || "0", currency, scale);
          if (parsed.isErr()) throw new Error(`Split amount: ${parsed.error.message}`);
          if (parsed.value === 0) throw new Error("A split line cannot be zero");
          return {
            categoryId: row.categoryId,
            amountMinor:
              row.direction === "outflow" ? -Math.abs(parsed.value) : Math.abs(parsed.value),
            memo: row.memo,
          };
        });
        if (splits.length < 2) throw new Error("A split needs at least two lines");
        if (splits.reduce((sum, split) => sum + split.amountMinor, 0) === 0) {
          throw new Error("A split cannot total zero");
        }
        if (existing) {
          replica.document.replaceSplits(existing.id, splits);
          setNotice("Split updated");
        } else {
          replica.document.createSplit({
            accountId,
            date,
            payeeId: payeeIdFor(snapshot.payees, payeeName),
            payeeName,
            memo,
            cleared,
            flag: flag || null,
            splits,
          });
          setNotice("Transaction added");
        }
        close();
        return;
      }

      const parsed = parseMoney(amount, currency, scale);
      if (parsed.isErr() || parsed.value === 0) {
        setError("Enter an amount");
        return;
      }
      const signed = direction === "outflow" ? -Math.abs(parsed.value) : Math.abs(parsed.value);

      if (isTransfer) {
        if (!transferAccountId) {
          setError("Choose the other account");
          return;
        }
        if (existing) {
          replica.document.updateTransaction(existing.id, {
            date,
            amountMinor: signed,
            memo,
            cleared,
          });
          setNotice("Transfer updated");
        } else {
          if (!targetAccount) {
            setError("Choose the other account");
            return;
          }
          replica.document.createTransfer({
            fromAccount: account,
            toAccount: targetAccount,
            date,
            amountMinor: Math.abs(parsed.value),
            categoryId: transferNeedsCategory ? categoryId : null,
            memo,
            cleared,
          });
          setNotice("Transfer added");
        }
        close();
        return;
      }

      const payeeId = payeeIdFor(snapshot.payees, payeeName);
      if (existing) {
        replica.document.updateTransaction(existing.id, {
          accountId,
          date,
          payeeId,
          payeeName,
          categoryId,
          amountMinor: signed,
          memo,
          flag: flag || null,
          cleared,
        });
        setNotice("Transaction updated");
      } else {
        replica.document.createTransaction({
          accountId,
          date,
          payeeId,
          payeeName,
          categoryId,
          amountMinor: signed,
          memo,
          cleared,
          flag: flag || null,
        });
        setNotice("Transaction added");
      }
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const remove = (): void => {
    if (!existing) return;
    if (!window.confirm("Delete this transaction?")) return;
    try {
      replica.document.deleteTransaction(existing.id);
      setNotice("Transaction deleted");
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={existing ? "Edit transaction" : "New transaction"}
      description={
        locked
          ? "This row is reconciled. Unlock the reconciliation in the account to edit it."
          : "Transfers and splits are ordinary records; the app keeps their pairs in step."
      }
      width="lg"
      footer={
        <>
          {existing ? (
            <Button variant="danger" onClick={remove} disabled={locked}>
              <Trash2 size={13} />
              Delete
            </Button>
          ) : null}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={locked}>
            {existing ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Field label="Account">
            <select
              value={accountId}
              disabled={Boolean(existing?.transferId) || splitMode}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink disabled:opacity-50"
            >
              {snapshot.accounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Payee">
            <TextInput
              value={payeeName}
              list="budget-payees"
              onChange={(event) => setPayeeName(event.target.value)}
              placeholder="Who was it?"
            />
            <datalist id="budget-payees">
              {snapshot.payees.map((payee) => (
                <option key={payee.id} value={payee.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Flag">
            <select
              value={flag}
              onChange={(event) => setFlag(event.target.value as TransactionFlag | "")}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              {FLAGS.map((item) => (
                <option key={item.id || "none"} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!splitMode ? (
          <div className="grid grid-cols-[130px_1fr_1fr] gap-3">
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
                placeholder="0.00"
              />
            </Field>
            <Field label={isTransfer ? "Category (when leaving the budget)" : "Category"}>
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                categories={snapshot.categories}
                groups={snapshot.categoryGroups}
                includeReadyToAssign
                ariaLabel="Category"
                disabled={isTransfer && !transferNeedsCategory}
              />
            </Field>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-canvas/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Split</p>
              <p className="tnum text-[12px] text-muted">Total {money(splitTotal)}</p>
            </div>
            <div className="space-y-2">
              {splitRows.map((row, index) => (
                <div key={row.key} className="grid grid-cols-[1fr_110px_1fr_28px] gap-2">
                  <CategoryPicker
                    value={row.categoryId}
                    onChange={(value) =>
                      setSplitRows((rows) =>
                        rows.map((candidate, position) =>
                          position === index ? { ...candidate, categoryId: value } : candidate,
                        ),
                      )
                    }
                    categories={snapshot.categories}
                    groups={snapshot.categoryGroups}
                    ariaLabel={`Split ${index + 1} category`}
                    includeReadyToAssign
                  />
                  <select
                    value={row.direction}
                    onChange={(event) =>
                      setSplitRows((rows) =>
                        rows.map((candidate, position) =>
                          position === index
                            ? {
                                ...candidate,
                                direction: event.target.value as "outflow" | "inflow",
                              }
                            : candidate,
                        ),
                      )
                    }
                    aria-label={`Split ${index + 1} direction`}
                    className="h-8 rounded-md border border-line bg-raised px-1 text-[12px] text-ink"
                  >
                    <option value="outflow">Out</option>
                    <option value="inflow">In</option>
                  </select>
                  <TextInput
                    value={row.amount}
                    inputMode="decimal"
                    aria-label={`Split ${index + 1} amount`}
                    onChange={(event) =>
                      setSplitRows((rows) =>
                        rows.map((candidate, position) =>
                          position === index
                            ? { ...candidate, amount: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                    placeholder="0.00"
                  />
                  <IconButton
                    label={`Remove split ${index + 1}`}
                    icon={<Trash2 size={13} />}
                    disabled={splitRows.length <= 2}
                    onClick={() =>
                      setSplitRows((rows) => rows.filter((_, position) => position !== index))
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setSplitRows((rows) => [...rows, blankRow()])}
            >
              <Plus size={12} />
              Add line
            </Button>
          </div>
        )}

        {!existing?.transferId ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={splitMode}
                onChange={(event) => setSplitMode(event.target.checked)}
                disabled={isTransfer}
                className="accent-[var(--accent)]"
              />
              Split this transaction
            </label>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={isTransfer}
                onChange={(event) => {
                  setTransferAccountId(
                    event.target.checked
                      ? (snapshot.accounts.find((candidate) => candidate.id !== accountId)?.id ??
                          "")
                      : "",
                  );
                  if (event.target.checked) setSplitMode(false);
                }}
                disabled={splitMode}
                className="accent-[var(--accent)]"
              />
              Transfer to another account
            </label>
          </div>
        ) : null}

        {isTransfer ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Other account">
              <select
                value={transferAccountId}
                disabled={Boolean(existing?.transferId)}
                onChange={(event) => setTransferAccountId(event.target.value)}
                className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink disabled:opacity-50"
              >
                <option value="">Choose an account…</option>
                {snapshot.accounts
                  .filter((candidate) => candidate.id !== accountId)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cleared">
              <select
                value={cleared}
                onChange={(event) => setCleared(event.target.value as ClearedStatus)}
                className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
              >
                <option value="uncleared">Uncleared</option>
                <option value="cleared">Cleared</option>
              </select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <Field label="Memo">
              <TextInput value={memo} onChange={(event) => setMemo(event.target.value)} />
            </Field>
            <Field label="Cleared">
              <select
                value={cleared}
                onChange={(event) => setCleared(event.target.value as ClearedStatus)}
                className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
              >
                <option value="uncleared">Uncleared</option>
                <option value="cleared">Cleared</option>
                {existing?.cleared === "reconciled" ? (
                  <option value="reconciled">Reconciled</option>
                ) : null}
              </select>
            </Field>
          </div>
        )}

        {splitMode ? (
          <Field label="Memo">
            <TextInput value={memo} onChange={(event) => setMemo(event.target.value)} />
          </Field>
        ) : null}

        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

function blankRow(): SplitRow {
  return {
    key: globalThis.crypto.randomUUID(),
    categoryId: null,
    amount: "",
    direction: "outflow",
    memo: "",
  };
}

function payeeIdFor(payees: { id: string; name: string }[], name: string): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return payees.find((payee) => payee.name.toLowerCase() === needle)?.id ?? null;
}
