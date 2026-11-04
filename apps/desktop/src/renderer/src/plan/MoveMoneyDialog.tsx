import { formatMoney, monthState, moveMoney, parseMoney } from "@suite/budget-core";
import { useMemo, useState } from "react";

import { Button } from "../components/Button";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function MoveMoneyDialog() {
  const open = useUiStore((state) => state.moveMoneyOpen);
  const setOpen = useUiStore((state) => state.setMoveMoneyOpen);
  const month = useUiStore((state) => state.month);
  const setNotice = useUiStore((state) => state.setNotice);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const state = useMemo(() => monthState(snapshot, month), [snapshot, month]);

  const [from, setFrom] = useState("rta");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [error, setError] = useState<string | null>(null);

  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const categories = state.groups.flatMap((group) =>
    group.categories.map((entry) => ({
      id: entry.category.id,
      name: entry.category.name,
      group: group.group.name,
      available: entry.availableMinor,
    })),
  );

  const submit = (): void => {
    const parsed = parseMoney(amount, currency, scale);
    if (parsed.isErr() || parsed.value <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (!to) {
      setError("Choose a destination");
      return;
    }
    const result = moveMoney(state, {
      fromCategoryId: from === "rta" ? "rta" : from,
      toCategoryId: to,
      amountMinor: parsed.value,
    });
    if (result.isErr()) {
      setError(result.error);
      return;
    }
    replica.document.applyAssignments(month, result.value);
    setNotice(`Moved ${money(parsed.value)}`);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Move money"
      description="Take money from Ready to Assign or one envelope and put it in another."
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Move
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="From">
          <select
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
          >
            <option value="rta">Ready to Assign · {money(state.readyToAssignMinor)}</option>
            {categories
              .filter((category) => category.available > 0)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.group} · {category.name} · {money(category.available)}
                </option>
              ))}
          </select>
        </Field>
        <Field label="To">
          <select
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
          >
            <option value="">Choose an envelope…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.group} · {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <TextInput
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
