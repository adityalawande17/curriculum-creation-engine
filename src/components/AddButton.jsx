"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";

export function AddButton({ node }) {
  const { onAddChild } = useCurriculumContext();
  const addLabel = LEVELS[node.type].addLabel;

  if (addLabel === null) {
    return null;
  }

  return (
    <button
      className="text-sm text-neutral-400 hover:text-(--brand)"
      onClick={() => onAddChild(node.id)}
    >
      {addLabel}
    </button>
  );
}
