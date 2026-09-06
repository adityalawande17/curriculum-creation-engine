"use client";

import { useCurriculumContext } from "@/lib/CurriculumContext";
import { EditableText } from "./EditableText";

export function CurriculumHeader() {
  const { root, updateField, stats, collapseAll } = useCurriculumContext();

  return (
    <header className="mb-8">
      <EditableText
        value={root.title}
        onChange={(value) => updateField(root.id, "title", value)}
        placeholder="Untitled Curriculum"
        variant="title"
        className="text-3xl font-semibold"
      />

      <EditableText
        value={root.description}
        onChange={(value) => updateField(root.id, "description", value)}
        placeholder="Click to add a description..."
        variant="description"
        className="mt-2 text-neutral-500"
      />

      <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500">
        <span>{stats.modules} modules</span>
        <span>{stats.topics} topics</span>
        <span>{stats.lessons} lessons</span>
        <button
          className="ml-auto text-neutral-400 hover:text-(--brand)"
          onClick={() => collapseAll(true)}
        >
          Collapse all
        </button>
        <button
          className="text-neutral-400 hover:text-(--brand)"
          onClick={() => collapseAll(false)}
        >
          Expand all
        </button>
      </div>
    </header>
  );
}
