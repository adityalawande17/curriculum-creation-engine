"use client";

import { useCurriculum } from "@/lib/useCurriculum";
import { createSeedState } from "@/lib/seedData"; // TEMPORARY — remove in Phase 5
import { CurriculumProvider } from "@/lib/CurriculumContext";
import { Node } from "@/components/Node";

export default function Home() {
  const curriculum = useCurriculum(createSeedState);

  return (
    <CurriculumProvider value={curriculum}>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Node id={curriculum.root.id} />
      </main>
    </CurriculumProvider>
  );
}
