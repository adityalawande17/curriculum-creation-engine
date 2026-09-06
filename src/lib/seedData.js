/**
 * TEMPORARY — Phase 3 checkpoint only, so the recursive Node component
 * has something real to render before Add/Delete exist (Phase 5).
 * All ids are fixed strings (not crypto.randomUUID()) for the same
 * reason the real root uses a fixed id: identical on server and client,
 * so no hydration mismatch. Delete this file once manual creation works.
 */
export function createSeedState() {
  const nodes = {
    root: {
      id: "root", type: "curriculum", parentId: null, origin: "manual",
      title: "Pflegefachassistent werden",
      description: "Foundational nursing assistant program.",
      childIds: ["m1", "m2", "m3"],
    },
    m1: {
      id: "m1", type: "module", parentId: "root", origin: "manual",
      title: "Module 1: Berufliches Selbstverständnis",
      description: "Professional identity and history.",
      childIds: ["t1", "t2"],
    },
    m2: {
      id: "m2", type: "module", parentId: "root", origin: "manual",
      title: "Module 2: Grundpflege",
      description: "Basic care techniques.",
      childIds: ["t3"],
    },
    m3: {
      id: "m3", type: "module", parentId: "root", origin: "manual",
      title: "Module 3: Kommunikation", description: "", childIds: [],
    },
    t1: {
      id: "t1", type: "topic", parentId: "m1", origin: "manual",
      title: "Topic 1.1: History & Professional Identity",
      description: "", childIds: ["l1", "l2"],
    },
    t2: {
      id: "t2", type: "topic", parentId: "m1", origin: "manual",
      title: "Topic 1.2: Ethics", description: "", childIds: [],
    },
    t3: {
      id: "t3", type: "topic", parentId: "m2", origin: "manual",
      title: "Topic 2.1: Personal Hygiene", description: "", childIds: [],
    },
    l1: {
      id: "l1", type: "lesson", parentId: "t1", origin: "manual",
      title: "Lesson 1: Origins of the Profession", description: "", childIds: [],
    },
    l2: {
      id: "l2", type: "lesson", parentId: "t1", origin: "manual",
      title: "Lesson 2: Modern Nursing Roles", description: "", childIds: [],
    },
  };

  return { rootId: "root", nodes, collapsed: new Set(), history: [] };
}
