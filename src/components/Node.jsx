"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";
import { EditableText } from "./EditableText";
import { Trash2 } from "lucide-react";
import { AddButton } from "./AddButton";

// Ugly on purpose for now — Phase 6 adds real visual hierarchy (indent,
// chips, guide lines). Phase 3's only job is proving the recursion works.
const INDENT_PX = 24;

export function Node({ id }) {
  const { getNode, updateField, lastCreatedId, onDeleteNode } =
    useCurriculumContext();
  const node = getNode(id);
  const level = LEVELS[node.type];
  const canDelete = node.parentId !== null; // the curriculum root can't be deleted

  return (
    // `group` here means any descendant can react to *this exact div*
    // being hovered, via `group-hover:...`, without any JS state.
    <div style={{ marginLeft: level.depth * INDENT_PX }} className="group my-2">
      <div className="flex items-center gap-2">
        <div className="text-xs uppercase text-neutral-400">{level.label}</div>

        {canDelete && (
          <button
            className="opacity-0 group-hover:opacity-100"
            onClick={() => onDeleteNode(node)}
          >
            <Trash2 />
          </button>
        )}
      </div>
      <EditableText
        value={node.title}
        onChange={(value) => updateField(node.id, "title", value)}
        placeholder={`Untitled ${level.label}`}
        variant="title"
        autoFocus={node.id === lastCreatedId}
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

      <AddButton node={node} />
    </div>
  );
}
