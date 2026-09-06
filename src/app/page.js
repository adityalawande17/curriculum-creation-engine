"use client";

import { useState, useEffect } from "react";
import { useCurriculum } from "@/lib/useCurriculum";
import { CurriculumProvider } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";
import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { Node } from "@/components/Node";
import { CurriculumHeader } from "@/components/CurriculumHeader";
import { EmptyState } from "@/components/EmptyState";
import { Toast } from "@/components/Toast";

export default function Home() {
  const curriculum = useCurriculum();
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [generatingModuleIds, setGeneratingModuleIds] = useState(new Set());
  // Keyed by module id -> everything retryModule() needs to try again,
  // since the module may no longer be reachable from current state by
  // the time Retry is clicked (e.g. if further edits happened meanwhile).
  const [failedModules, setFailedModules] = useState({});

  function handleAddChild(parentId) {
    const id = curriculum.addChild(parentId);
    setLastCreatedId(id);
  }

  function handleDeleteNode(node) {
    curriculum.deleteNode(node.id);
    setToast({ message: `${LEVELS[node.type].label} deleted` });
  }

  // One module's worth of Pass 2. Reads its title/description/topics
  // from the plain data it's given (moduleNode, topicNodes) rather than
  // from curriculum.state — the caller has this data already, and
  // curriculum.state wouldn't be reliably fresh yet anyway, since
  // dispatch() doesn't apply synchronously.
  async function generateLessonsForModule(moduleNode, topicNodes, curriculumTitle) {
    setGeneratingModuleIds((prev) => new Set(prev).add(moduleNode.id));
    setFailedModules((prev) => {
      const next = { ...prev };
      delete next[moduleNode.id];
      return next;
    });

    try {
      const response = await fetch("/api/generate-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumTitle,
          moduleTitle: moduleNode.title,
          moduleDescription: moduleNode.description,
          topics: topicNodes.map((t) => ({ title: t.title, description: t.description })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate lessons");

      // Match each result back to its topic node by title — this route
      // never sees our internal node ids, only plain text (schema.js).
      for (const topicResult of data.topics) {
        const topicNode = topicNodes.find((t) => t.title === topicResult.topicTitle);
        if (topicNode) {
          curriculum.attachLessons(topicNode.id, topicResult.lessons);
        }
      }
    } catch {
      // One module failing must not break the others — runWithConcurrencyLimit's
      // worker loop only awaits *this* module's promise, so a rejection
      // here can't cancel modules 1-13 or 15-20 (CLAUDE.md §8.4).
      setFailedModules((prev) => ({
        ...prev,
        [moduleNode.id]: { moduleNode, topicNodes, curriculumTitle },
      }));
    } finally {
      setGeneratingModuleIds((prev) => {
        const next = new Set(prev);
        next.delete(moduleNode.id);
        return next;
      });
    }
  }

  // Called right after Replace/Add applies an AI tree. Takes the local
  // `tree` object straight from aiToNodes.js — not curriculum.state,
  // for the same "not synchronously fresh yet" reason as above.
  async function generateLessonsForTree(tree) {
    const modules = Object.values(tree.nodes).filter((n) => n.type === "module");
    const curriculumTitle = tree.nodes[tree.rootId].title;

    await runWithConcurrencyLimit(modules, 4, async (moduleNode) => {
      const topicNodes = moduleNode.childIds.map((id) => tree.nodes[id]);
      if (topicNodes.length === 0) return; // nothing to generate lessons for
      await generateLessonsForModule(moduleNode, topicNodes, curriculumTitle);
    });
  }

  function retryModule(moduleId) {
    const failed = failedModules[moduleId];
    if (!failed) return;
    generateLessonsForModule(failed.moduleNode, failed.topicNodes, failed.curriculumTitle);
  }

  // Registered once on mount (empty dependency array). It's safe to keep
  // calling curriculum.undo() from this very first render forever,
  // because undo() only ever calls the stable `dispatch` from useReducer
  // with { type: "UNDO" } — and the reducer reads *current* state the
  // moment that action arrives, not a snapshot from whenever this effect
  // was created. This is Known Trap #4's "preferred" fix, and it's
  // automatic here because of how the reducer was designed, not
  // something we had to work around.
  useEffect(() => {
    function handleKeyDown(event) {
      const isUndoShortcut = (event.ctrlKey || event.metaKey) && event.key === "z";
      if (isUndoShortcut) {
        event.preventDefault();
        curriculum.undo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const contextValue = {
    ...curriculum,
    lastCreatedId,
    onAddChild: handleAddChild,
    onDeleteNode: handleDeleteNode,
    generatingModuleIds,
    failedModuleIds: new Set(Object.keys(failedModules)),
    onGenerateLessons: generateLessonsForTree,
    onRetryLessons: retryModule,
  };

  return (
    <CurriculumProvider value={contextValue}>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <CurriculumHeader />
        {curriculum.root.childIds.length === 0 ? (
          <EmptyState />
        ) : (
          curriculum.root.childIds.map((moduleId, index) => (
            <Node key={moduleId} id={moduleId} number={String(index + 1)} />
          ))
        )}
      </main>
      <Toast toast={toast} onUndo={curriculum.undo} onDismiss={() => setToast(null)} />
    </CurriculumProvider>
  );
}
