import type { ReactNode } from "react";

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
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-panel/40 p-8 text-center">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-[13px] leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}
