import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { LibraryEntry } from "@suite/budget-core";
import { Button, Launch, type LaunchRecent, PrivacyLine } from "@suite/ui";
import { FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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

  const recents: LaunchRecent[] = entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    detail: `${entry.currency} · opened ${formatWhen(entry.lastOpenedAt)}`,
    action: (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={`Actions for ${entry.name}`} icon={<MoreHorizontal size={16} />} />
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
            <MenuItem icon={<FolderOpen size={14} />} onSelect={() => onReveal(entry.id)}>
              Show in folder
            </MenuItem>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setRemoving(entry)}>
              Remove from library
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    ),
  }));

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-10">
        <Launch
          mark={<BudgetMark size="md" />}
          title="Suite Budget"
          tagline="A budget is a file on this machine."
          hint="Give every dollar a job, or bring in the transactions your bank already exported."
          actions={
            <Button variant="primary" onClick={() => setNewBudgetOpen(true)} disabled={busy}>
              <Plus size={14} />
              New budget
            </Button>
          }
          importOptions={[
            {
              label: "Bank export",
              detail: "A CSV your bank gave you",
              onSelect: onImport,
            },
          ]}
          recents={recents}
          onOpenRecent={(id) => onOpen(id)}
          recentEmpty={
            <div className="rounded-xl border border-dashed border-line bg-panel/50 px-6 py-8 text-center">
              <p className="text-[13px] font-medium text-ink">No budgets yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted">
                Start one and it becomes a file in your documents folder. Nothing leaves this
                machine.
              </p>
            </div>
          }
          footer={
            <>
              <div className="w-[190px]">
                <ThemePicker />
              </div>
              <PrivacyLine />
            </>
          }
        />
      </div>

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
    </>
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
