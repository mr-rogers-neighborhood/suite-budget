import { BudgetDocument, type BudgetSnapshot } from "@suite/budget-core";
import { createContext, useContext, useSyncExternalStore } from "react";

import { getBridge } from "../platform/bridge";

/**
 * The renderer's replica of the open budget. This file owns the single `observe` call site:
 * edits are merged locally, forwarded to main as CRDT updates, and the UI reads a snapshot.
 */
export class DocumentReplica {
  #doc: BudgetDocument;
  #snapshot: BudgetSnapshot;
  #listeners = new Set<() => void>();
  #detach: () => void;

  constructor(doc: BudgetDocument) {
    this.#doc = doc;
    this.#snapshot = doc.getSnapshot();
    this.#detach = this.watch();
  }

  get document(): BudgetDocument {
    return this.#doc;
  }

  getSnapshot = (): BudgetSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  refresh(): void {
    this.#snapshot = this.#doc.getSnapshot();
    for (const listener of this.#listeners) listener();
  }

  replace(bytes: Uint8Array): void {
    this.#detach();
    this.#doc = BudgetDocument.fromSnapshot(bytes);
    this.#detach = this.watch();
    this.refresh();
  }

  dispose(): void {
    this.#detach();
    this.#listeners.clear();
  }

  undo(): void {
    this.#doc.undo();
  }

  redo(): void {
    this.#doc.redo();
  }

  canUndo(): boolean {
    return this.#doc.canUndo();
  }

  canRedo(): boolean {
    return this.#doc.canRedo();
  }

  private watch(): () => void {
    return this.#doc.observe((update) => {
      void getBridge()
        .commit(update)
        .catch((error: unknown) =>
          console.error("Suite Budget: could not commit an update", error),
        );
      this.refresh();
    });
  }
}

export const WorkspaceContext = createContext<DocumentReplica | null>(null);

export function bootDocument(snapshot: Uint8Array): DocumentReplica {
  return new DocumentReplica(BudgetDocument.fromSnapshot(snapshot));
}

export function useReplica(): DocumentReplica {
  const replica = useContext(WorkspaceContext);
  if (!replica) throw new Error("useReplica must be used inside WorkspaceContext");
  return replica;
}

export function useWorkspaceSnapshot(): BudgetSnapshot {
  const replica = useReplica();
  return useSyncExternalStore(replica.subscribe, replica.getSnapshot, replica.getSnapshot);
}
