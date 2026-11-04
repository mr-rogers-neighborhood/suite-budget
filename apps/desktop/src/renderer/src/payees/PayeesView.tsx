import type { Payee } from "@suite/budget-core";
import { Merge, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../components/Button";
import { CategoryPicker } from "../components/CategoryPicker";
import { EmptyState } from "../components/EmptyState";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function PayeesView() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const setNotice = useUiStore((state) => state.setNotice);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Payee | "new" | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");

  const payees = snapshot.payees.filter((payee) =>
    payee.name.toLowerCase().includes(search.toLowerCase()),
  );
  const categoryName = (id: string | null) =>
    snapshot.categories.find((category) => category.id === id)?.name ?? "—";

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-[16px] font-semibold text-ink">Payees</h1>
          <p className="mt-0.5 text-[11px] text-faint">
            Remember the last category for a payee; learned rules live in Rules.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-2 text-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payees"
              aria-label="Search payees"
              className="h-7 w-full rounded-md border border-line bg-raised pl-7 pr-2 text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>
          <Button size="sm" onClick={() => setMerging(true)}>
            <Merge size={13} />
            Merge
          </Button>
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            <Plus size={13} />
            Add payee
          </Button>
        </div>
      </div>

      {payees.length === 0 ? (
        <EmptyState
          title={search ? "No payees match" : "No payees yet"}
          body="A payee is created automatically when you type one on a transaction or import a file."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus size={14} />
              Add payee
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_100px_120px] border-b border-line bg-panel/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            <span>Name</span>
            <span>Default category</span>
            <span>Last used</span>
            <span className="text-right">Transactions</span>
            <span className="text-right">Learning</span>
          </div>
          {payees.map((payee) => (
            <div
              key={payee.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_100px_120px] items-center border-b border-line/50 px-4 py-2 text-[12px] last:border-0 hover:bg-raised/40"
            >
              <button
                type="button"
                onClick={() => setEditing(payee)}
                className="truncate text-left text-ink hover:underline"
              >
                {payee.name}
                {payee.archivedAt ? <span className="ml-2 text-faint">archived</span> : null}
              </button>
              <span className="truncate text-muted">{categoryName(payee.defaultCategoryId)}</span>
              <span className="truncate text-faint">{categoryName(payee.lastCategoryId)}</span>
              <span className="tnum text-right text-faint">
                {
                  snapshot.transactions.filter((transaction) => transaction.payeeId === payee.id)
                    .length
                }
              </span>
              <span className="text-right">
                <button
                  type="button"
                  onClick={() => replica.document.updatePayee(payee.id, { learn: !payee.learn })}
                  className={
                    payee.learn
                      ? "text-[11px] text-accent"
                      : "text-[11px] text-faint hover:text-muted"
                  }
                >
                  {payee.learn ? "Learning" : "Paused"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <PayeeDialog
        payee={editing}
        onClose={() => setEditing(null)}
        onError={(message) => setNotice(message, "error")}
      />

      <Modal
        open={merging}
        onOpenChange={setMerging}
        title="Merge payees"
        description="Every transaction on the first payee moves to the second. The first payee is removed."
        width="sm"
        footer={
          <>
            <Button onClick={() => setMerging(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
              onClick={() => {
                try {
                  replica.document.mergePayees(mergeFrom, mergeTo);
                  setNotice("Payees merged");
                  setMerging(false);
                  setMergeFrom("");
                  setMergeTo("");
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : "Could not merge", "error");
                }
              }}
            >
              Merge
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="From">
            <select
              value={mergeFrom}
              onChange={(event) => setMergeFrom(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              <option value="">Choose a payee…</option>
              {snapshot.payees.map((payee) => (
                <option key={payee.id} value={payee.id}>
                  {payee.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Into">
            <select
              value={mergeTo}
              onChange={(event) => setMergeTo(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              <option value="">Choose a payee…</option>
              {snapshot.payees
                .filter((payee) => payee.id !== mergeFrom)
                .map((payee) => (
                  <option key={payee.id} value={payee.id}>
                    {payee.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function PayeeDialog({
  payee,
  onClose,
  onError,
}: {
  payee: Payee | "new" | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const isNew = payee === "new";
  const record = payee && payee !== "new" ? payee : undefined;
  const [name, setName] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [learn, setLearn] = useState(true);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (!payee) return;
    setName(record?.name ?? "");
    setDefaultCategoryId(record?.defaultCategoryId ?? null);
    setLearn(record?.learn ?? true);
    setArchived(Boolean(record?.archivedAt));
  }, [payee, record]);

  if (!payee) return null;

  return (
    <Modal
      open={payee !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isNew ? "Add payee" : "Edit payee"}
      width="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={name.trim().length === 0}
            onClick={() => {
              try {
                if (isNew) {
                  replica.document.createPayee({
                    name: name.trim(),
                    defaultCategoryId,
                  });
                } else if (record) {
                  replica.document.updatePayee(record.id, {
                    name: name.trim(),
                    defaultCategoryId,
                    learn,
                    archivedAt: archived ? (record.archivedAt ?? new Date().toISOString()) : null,
                  });
                }
                onClose();
              } catch (error) {
                onError(error instanceof Error ? error.message : "Could not save");
              }
            }}
          >
            {isNew ? "Add" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name">
          <TextInput value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Default category">
          <CategoryPicker
            value={defaultCategoryId}
            onChange={setDefaultCategoryId}
            categories={snapshot.categories}
            groups={snapshot.categoryGroups}
            ariaLabel="Default category"
          />
        </Field>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={learn}
            onChange={(event) => setLearn(event.target.checked)}
            className="accent-[var(--accent)]"
          />
          Learn from how I categorize this payee
        </label>
        {!isNew ? (
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Archived
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
