"use client";

import { useState, useEffect } from "react";
import { useCurriculum } from "@/lib/useCurriculum";
import { createSeedState } from "@/lib/seedData"; // TEMPORARY — see Phase 3
import { CurriculumProvider } from "@/lib/CurriculumContext";
import { LEVELS } from "@/lib/levels";
import { Node } from "@/components/Node";
import { CurriculumHeader } from "@/components/CurriculumHeader";
import { Toast } from "@/components/Toast";

export default function Home() {
  const curriculum = useCurriculum(createSeedState);
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const [toast, setToast] = useState(null);

  function handleAddChild(parentId) {
    const id = curriculum.addChild(parentId);
    setLastCreatedId(id);
  }

  function handleDeleteNode(node) {
    curriculum.deleteNode(node.id);
    setToast({ message: `${LEVELS[node.type].label} deleted` });
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
  };

  return (
    <CurriculumProvider value={contextValue}>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <CurriculumHeader />
        {curriculum.root.childIds.map((moduleId) => (
          <Node key={moduleId} id={moduleId} />
        ))}
      </main>
      <Toast toast={toast} onUndo={curriculum.undo} onDismiss={() => setToast(null)} />
    </CurriculumProvider>
  );
}
