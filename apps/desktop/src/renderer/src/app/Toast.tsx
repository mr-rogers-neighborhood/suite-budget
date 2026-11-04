import { useEffect } from "react";

import { useUiStore } from "../store/uiStore";

export function Toast() {
  const notice = useUiStore((state) => state.notice);
  const clearNotice = useUiStore((state) => state.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 4500);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  if (!notice) return null;
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={
        notice.tone === "error"
          ? "fixed bottom-5 right-5 z-[70] max-w-md rounded-lg border border-danger/40 bg-panel px-4 py-3 text-[13px] text-danger shadow-2xl"
          : "fixed bottom-5 right-5 z-[70] max-w-md rounded-lg border border-line bg-panel px-4 py-3 text-[13px] text-ink shadow-2xl"
      }
    >
      <div className="flex items-start gap-3">
        <p className="leading-relaxed">{notice.message}</p>
        <button
          type="button"
          onClick={clearNotice}
          className="text-[11px] text-faint hover:text-ink"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
