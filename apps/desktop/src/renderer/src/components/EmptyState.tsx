import { EmptyState as SharedEmptyState } from "@suite/ui";
import type { ReactNode } from "react";

/**
 * The "nothing here yet" panel, on the shared one.
 *
 * This app renders it full-height inside a view, which the shared component leaves to its
 * caller — so the wrapper is the sizing, and the dashed edge, the spacing and the type all come
 * from `@suite/ui`. One frame to style instead of two.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center">
      <SharedEmptyState title={title} action={action} className="w-full max-w-md">
        {body}
      </SharedEmptyState>
    </div>
  );
}
