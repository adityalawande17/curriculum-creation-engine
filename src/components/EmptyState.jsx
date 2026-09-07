"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";

export function EmptyState() {
  const { root, onAddChild, onOpenUpload } = useCurriculumContext();

  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 py-16 text-center">
      <p className="text-neutral-500">This curriculum is empty.</p>
      <div className="flex gap-3">
        <button
          className="rounded-md bg-(--brand) px-4 py-2 text-sm font-semibold text-white"
          onClick={() => onAddChild(root.id)}
        >
          Add your first module
        </button>
        <button
          className="rounded-md border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
          onClick={onOpenUpload}
        >
          Upload a PDF
        </button>
      </div>
    </div>
  );
}
