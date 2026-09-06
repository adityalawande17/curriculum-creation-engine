"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { countByType, countInferred } from "@/lib/nodes";

/**
 * `outline` is the raw AI response (has detected/reasoning/titles).
 * `tree` is the already-converted { rootId, nodes } shape from
 * aiToNodes.js — ready to hand straight to replaceTree/mergeTree.
 */
export function ReviewPanel({ outline, tree, onDismiss, onRetry }) {
  const { replaceTree, mergeTree, root, onGenerateLessons } = useCurriculumContext();

  if (outline.detected === "none") {
    return (
      <div className="space-y-4 text-center">
        <p className="font-semibold">This doesn't look like a curriculum.</p>
        <p className="text-sm text-neutral-500 italic">&quot;{outline.reasoning}&quot;</p>
        <div className="flex justify-center gap-3">
          <button
            className="rounded-md bg-(--brand) px-4 py-2 text-sm font-semibold text-white"
            onClick={onDismiss}
          >
            Start a blank curriculum
          </button>
          <button
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
            onClick={onRetry}
          >
            Try a different file
          </button>
        </div>
      </div>
    );
  }

  const counts = countByType(tree.nodes);
  const inferred = countInferred(tree.nodes);

  function handleReplace() {
    replaceTree(tree);
    onGenerateLessons(tree);
    onDismiss();
  }

  function handleAdd() {
    mergeTree(tree.nodes, root.id);
    onGenerateLessons(tree);
    onDismiss();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">
        Found <strong>{counts.modules}</strong> module{counts.modules === 1 ? "" : "s"},{" "}
        <strong>{counts.topics}</strong> topic{counts.topics === 1 ? "" : "s"}.
      </p>
      {inferred > 0 && (
        <p className="text-sm text-neutral-500">
          {inferred} item{inferred === 1 ? " was" : "s were"} inferred — not found directly in
          the document.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600"
          onClick={onDismiss}
        >
          Discard
        </button>
        <button
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600"
          onClick={handleAdd}
        >
          Add to existing
        </button>
        <button
          className="rounded-md bg-(--brand) px-3 py-1.5 text-sm font-semibold text-white"
          onClick={handleReplace}
        >
          Replace
        </button>
      </div>
    </div>
  );
}
