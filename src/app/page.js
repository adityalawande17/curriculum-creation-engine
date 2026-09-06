"use client";

import { useCurriculum } from "@/lib/useCurriculum";

// TEMPORARY — Phase 2 checkpoint only. Real UI (CurriculumHeader + Node)
// gets built in Phase 3. This just proves the reducer/hook actually work.
export default function Home() {
  const { state, root, addChild } = useCurriculum();

  console.log(state);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <p>Root node id: {root.id}</p>
        <p>Root childIds: {JSON.stringify(root.childIds)}</p>
        <button
          className="mt-4 rounded bg-(--brand) px-4 py-2 text-white"
          onClick={() => addChild(root.id)}
        >
          Add Module (test)
        </button>
      </main>
    </div>
  );
}
