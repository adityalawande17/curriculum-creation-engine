"use client";

import { useEffect } from "react";

const AUTO_DISMISS_MS = 6000;

/**
 * `toast` is either null (nothing to show) or { message }. Rendered once,
 * at the top level (page.js) — not inside the recursive Node tree.
 */
export function Toast({ toast, onUndo, onDismiss }) {
  // Every time `toast` changes to a new value, any previous timer must be
  // cancelled before starting a new one — otherwise an old delete's timer
  // could fire later and dismiss a *newer* toast early. The cleanup
  // function (the `return` below) runs right before this effect re-runs,
  // which is exactly when that old timer needs to die.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{toast.message}</span>
      <button
        className="font-semibold text-(--brand) underline"
        onClick={() => {
          onUndo();
          onDismiss();
        }}
      >
        Undo
      </button>
    </div>
  );
}
