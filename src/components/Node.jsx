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

export function Node({ id, number }) {
  const {
    getNode,
    updateField,
    lastCreatedId,
    onDeleteNode,
    state,
    toggleCollapse,
    generatingModuleIds,
    failedModuleIds,
    onRetryLessons,
  } = useCurriculumContext();
  const node = getNode(id);
  const level = LEVELS[node.type];
  const canDelete = node.parentId !== null; // the curriculum root can't be deleted
  const canCollapse = level.child !== null; // lessons have no children to hide
  const isCollapsed = canCollapse && state.collapsed.has(node.id);
  const isGeneratingLessons = node.type === "module" && generatingModuleIds.has(node.id);
  const lessonsFailed = node.type === "module" && failedModuleIds.has(node.id);
  // Each level gets its own *named* group (group/module, group/topic,
  // group/lesson) instead of one shared name. Names must appear as
  // complete literal strings for Tailwind to generate CSS for them — it
  // scans source text, it doesn't run this code — so each branch spells
  // its own name out in full rather than building one with `node.type`.
  // chipClassName follows the spec examples literally: "MODULE 1" is
  // uppercase, but "Topic 1.2" and "Lesson 1.2.3" are not.
  let containerClassName;
  let deleteHoverClassName;
  let chipClassName;
  let titleClassName = "";
  if (node.type === "module") {
    containerClassName =
      "group/module my-2 bg-white border border-neutral-200 rounded-xl shadow-sm border-l-[3px] border-l-(--brand) p-4";
    deleteHoverClassName = "opacity-0 group-hover/module:opacity-100";
    chipClassName =
      "text-xs font-semibold uppercase tracking-wide text-neutral-500";
    titleClassName = "text-[17px] font-semibold";
  } else if (node.type === "topic") {
    containerClassName =
      "group/topic my-2 bg-neutral-50/60 rounded-lg border-l-2 border-l-neutral-300 p-3";
    deleteHoverClassName = "opacity-0 group-hover/topic:opacity-100";
    chipClassName = "text-xs font-medium text-neutral-500";
    titleClassName = "text-[15px] font-medium";
  } else {
    containerClassName = "group/lesson my-2";
    deleteHoverClassName = "opacity-0 group-hover/lesson:opacity-100";
    chipClassName = "text-xs text-neutral-400";
    titleClassName = "text-[14px]";
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

        <div className={chipClassName}>
          {level.label} {number}
        </div>

        {canDelete && (
          <button
            className={deleteHoverClassName}
            onClick={() => onDeleteNode(node)}
          >
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
        className={titleClassName}
      />
      <EditableText
        value={node.description}
        onChange={(value) => updateField(node.id, "description", value)}
        placeholder="Click to add a description..."
        variant="description"
        className="text-sm text-neutral-500"
      />

      {isGeneratingLessons && (
        <div className="mt-1 animate-pulse text-xs text-neutral-400">
          Generating lessons…
        </div>
      )}
      {lessonsFailed && (
        <button
          className="mt-1 text-xs text-red-500 underline"
          onClick={() => onRetryLessons(node.id)}
        >
          Couldn&apos;t generate lessons — Retry
        </button>
      )}

      {isCollapsed ? (
        <div className="mt-1 text-xs text-neutral-400">
          {formatSummary(countDescendantsByType(state.nodes, node.id))}
        </div>
      ) : (
        // Guide line: a left border on the whole children group, so
        // there's a visible spine connecting this node to what's under
        // it — this is what makes deep nesting readable instead of just
        // indentation alone. Skipped entirely for lessons (canCollapse
        // false), since they have neither children nor an Add button.
        canCollapse && (
          <div className="ml-1 border-l border-neutral-200 pl-3">
            {node.childIds.length === 0 && (
              <div className="text-xs text-neutral-400">No {level.child}s yet</div>
            )}
            {node.childIds.map((childId, index) => (
              <Node
                key={childId}
                id={childId}
                number={`${number}.${index + 1}`}
              />
            ))}
            <AddButton node={node} />
          </div>
        )
      )}
    </div>
  );
}
