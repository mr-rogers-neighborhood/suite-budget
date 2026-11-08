import { Toast as SharedToast } from "@suite/ui";

import { useUiStore } from "../store/uiStore";

/**
 * The app's toast, on the shared one.
 *
 * The store already holds `{ message, tone }` and the shared component takes the same shape, so
 * there is no adapter — and the tone decides the ARIA role in one place rather than in each app
 * that shows a message.
 */
export function Toast() {
  const notice = useUiStore((state) => state.notice);
  const clearNotice = useUiStore((state) => state.clearNotice);

  return <SharedToast notice={notice} onDismiss={clearNotice} />;
}
