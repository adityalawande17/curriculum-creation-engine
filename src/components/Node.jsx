"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";
import { countDescendantsByType } from "@/lib/nodes";
import { EditableText } from "./EditableText";
import { Trash2, ChevronRight } from "lucide-react";
import { AddButton } from "./AddButton";

// Ugly on purpose for now — Phase 6 adds real visual hierarchy (indent,
// chips, guide lines). Phase 3's only job is proving the recursion works.
const INDENT_PX = 24;

function formatSummary(counts) {
  const parts = [];
  if (counts.topics > 0) {
    parts.push(`${counts.topics} topic${counts.topics === 1 ? "" : "s"}`);
  }
  if (counts.lessons > 0) {
    parts.push(`${counts.lessons} lesson${counts.lessons === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "empty";
}

export function Node({ id }) {
  const {
    getNode,
    updateField,
    lastCreatedId,
    onDeleteNode,
    state,
    toggleCollapse,
  } = useCurriculumContext();
  const node = getNode(id);
  const level = LEVELS[node.type];
  const canDelete = node.parentId !== null; // the curriculum root can't be deleted
  const canCollapse = level.child !== null; // lessons have no children to hide
  const isCollapsed = canCollapse && state.collapsed.has(node.id);
  // Each level gets its own *named* group (group/module, group/topic,
  // group/lesson) instead of one shared name. Names must appear as
  // complete literal strings for Tailwind to generate CSS for them — it
  // scans source text, it doesn't run this code — so each branch spells
  // its own name out in full rather than building one with `node.type`.
  let containerClassName;
  let deleteHoverClassName;
  if (node.type === "module") {
    containerClassName =
      "group/module my-2 bg-white border border-neutral-200 rounded-xl shadow-sm border-l-[3px] border-l-(--brand) p-4";
    deleteHoverClassName = "opacity-0 group-hover/module:opacity-100";
  } else if (node.type === "topic") {
    containerClassName =
      "group/topic my-2 bg-neutral-50/60 rounded-lg border-l-2 border-l-neutral-300 p-3";
    deleteHoverClassName = "opacity-0 group-hover/topic:opacity-100";
  } else {
    containerClassName = "group/lesson my-2";
    deleteHoverClassName = "opacity-0 group-hover/lesson:opacity-100";
  }

  return (
    <div
      style={{ marginLeft: level.depth * INDENT_PX }}
      className={containerClassName}
    >
      <div className="flex items-center gap-2">
        {canCollapse && (
          <button
            onClick={() => toggleCollapse(node.id)}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            className="text-neutral-400"
          >
            <ChevronRight
              size={16}
              className={`transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
            />
          </button>
        )}

        <div className="text-xs uppercase text-neutral-400">{level.label}</div>

        {canDelete && (
          <button className={deleteHoverClassName} onClick={() => onDeleteNode(node)}>
            <Trash2 size={16} />
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

      {isCollapsed ? (
        <div className="mt-1 text-xs text-neutral-400">
          {formatSummary(countDescendantsByType(state.nodes, node.id))}
        </div>
      ) : (
        <>
          {node.childIds.map((childId) => (
            <Node key={childId} id={childId} />
          ))}
          <AddButton node={node} />
        </>
      )}
    </div>
  );
}
