"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";
import { EditableText } from "./EditableText";

// Ugly on purpose for now — Phase 6 adds real visual hierarchy (indent,
// chips, guide lines). Phase 3's only job is proving the recursion works.
const INDENT_PX = 24;

export function Node({ id }) {
  const { getNode, updateField } = useCurriculumContext();
  const node = getNode(id);
  const level = LEVELS[node.type];

  return (
    <div style={{ marginLeft: level.depth * INDENT_PX }} className="my-2">
      <div className="text-xs uppercase text-neutral-400">{level.label}</div>

      <EditableText
        value={node.title}
        onChange={(value) => updateField(node.id, "title", value)}
        placeholder={`Untitled ${level.label}`}
        variant="title"
        className="font-semibold"
      />

      <EditableText
        value={node.description}
        onChange={(value) => updateField(node.id, "description", value)}
        placeholder="Click to add a description..."
        variant="description"
        className="text-sm text-neutral-500"
      />

      {node.childIds.map((childId) => (
        <Node key={childId} id={childId} />
      ))}
    </div>
  );
}
