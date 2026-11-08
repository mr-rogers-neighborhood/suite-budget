import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { LibraryEntry } from "@suite/budget-core";
import { Button } from "@suite/ui";
import { FolderOpen, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BudgetMark } from "../app/BudgetMark";
import { IconButton } from "../components/IconButton";
import { TextPrompt } from "../components/TextPrompt";
import { useUiStore } from "../store/uiStore";
import { ThemePicker } from "../theme/ThemePicker";

export type BudgetLauncherProps = {
  entries: LibraryEntry[];
  busy: boolean;
  onOpen: (id: string) => void;
  onImport: () => void;
  onRemove: (id: string) => void;
  onReveal: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

export function BudgetLauncher({
  entries,
  busy,
  onOpen,
  onImport,
  onRemove,
  onReveal,
  onRename,
}: BudgetLauncherProps) {
  const setNewBudgetOpen = useUiStore((state) => state.setNewBudgetOpen);
  const [renaming, setRenaming] = useState<LibraryEntry | null>(null);
  const [removing, setRemoving] = useState<LibraryEntry | null>(null);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-line px-8 py-5">
        <BudgetMark size="md" />
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-ink">Suite Budget</p>
          <p className="text-[11px] text-faint">Local budgets · no account · no network</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-[190px]">
            <ThemePicker />
          </div>
          <Button onClick={onImport} disabled={busy}>
            <Upload size={14} />
            Import
          </Button>
          <Button variant="primary" onClick={() => setNewBudgetOpen(true)} disabled={busy}>
            <Plus size={14} />
            New budget
          </Button>
        </div>
      </header>

      <main className="scroll flex-1 overflow-y-auto px-8 py-8">
        {entries.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-panel/50 p-10 text-center">
            <h1 className="text-xl font-semibold text-ink">Start with the money you have</h1>
            <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-muted">
              A budget is a file on this machine. Give every dollar a job, import transactions from
              your bank's CSV, and export everything whenever you want. No account, no server, no
              telemetry.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="primary" onClick={() => setNewBudgetOpen(true)}>
                <Plus size={14} />
                Start a budget
              </Button>
              <Button onClick={onImport}>
                <Upload size={14} />
                Import a file
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <h1 className="text-[13px] font-semibold uppercase tracking-wider text-faint">
              Recent budgets
            </h1>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-4 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onOpen(entry.id)}
                    disabled={busy}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[14px] font-medium text-ink">{entry.name}</p>
                    <p className="mt-0.5 text-[11px] text-faint">
                      {entry.currency} · opened {formatWhen(entry.lastOpenedAt)}
                    </p>
                  </button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <IconButton
                        label={`Actions for ${entry.name}`}
                        icon={<MoreHorizontal size={16} />}
                      />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        sideOffset={4}
                        className="z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-xl"
                      >
                        <MenuItem icon={<FolderOpen size={14} />} onSelect={() => onOpen(entry.id)}>
                          Open
                        </MenuItem>
                        <MenuItem icon={<Pencil size={14} />} onSelect={() => setRenaming(entry)}>
                          Rename
                        </MenuItem>
                        <MenuItem
                          icon={<FolderOpen size={14} />}
                          onSelect={() => onReveal(entry.id)}
                        >
                          Show in folder
                        </MenuItem>
                        <DropdownMenu.Separator className="my-1 h-px bg-line" />
                        <MenuItem
                          icon={<Trash2 size={14} />}
                          danger
                          onSelect={() => setRemoving(entry)}
                        >
                          Remove from library
                        </MenuItem>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-faint">
              Removing a budget from the library leaves the file on disk. Closing the window quits
              the app; there is no background service.
            </p>
          </div>
        )}
      </main>

      <TextPrompt
        open={renaming !== null}
        title="Rename budget"
        label="Name"
        initialValue={renaming?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        onConfirm={(value) => {
          if (renaming) onRename(renaming.id, value);
          setRenaming(null);
        }}
      />

      <TextPrompt
        open={removing !== null}
        title="Remove from library?"
        description="The file stays on disk. You can open it again with Import."
        label="Type the budget name to remove it"
        initialValue=""
        confirmLabel="Remove"
        confirmDisabled={(value) => value !== removing?.name}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={(value) => {
          if (removing && value === removing.name) onRemove(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function MenuItem({
  children,
  icon,
  danger = false,
  onSelect,
}: {
  children: string;
  icon: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-raised ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
