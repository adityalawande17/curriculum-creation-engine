import { createNode } from "./nodes";

/**
 * Converts the AI's nested Pass 1 response (matching schema.js's
 * OutlineSchema) into our real flat { rootId, nodes } shape — the exact
 * same shape createInitialState() and the seed data produce. That's
 * deliberate: once this function runs, REPLACE_TREE/MERGE_TREE and
 * every component downstream don't know or care that the tree came
 * from an AI instead of a person clicking "Add Module".
 *
 * `inferred: true/false` from the AI becomes `origin`: a module or
 * topic that was really in the document is "ai"; one the model
 * invented to fill a gap is "ai-inferred", which is what powers the
 * provenance badge (CLAUDE.md §4.7).
 *
 * Mutating `childIds` directly here (rather than the immutable
 * `[...arr, id]` pattern used inside the reducer) is safe: this tree is
 * being built from scratch and hasn't been handed to React as state
 * yet. Immutability only matters once something is state React is
 * already tracking — before that, it's just a local object under
 * construction.
 *
 * @param {import("./schema").OutlineSchema} outline
 * @returns {{ rootId: string, nodes: Record<string, import("./nodes").Node> }}
 */
export function aiOutlineToTree(outline) {
  const nodes = {};

  const root = createNode("curriculum", null, {
    title: outline.curriculumTitle,
    description: outline.curriculumDescription,
    origin: "ai",
  });
  nodes[root.id] = root;

  for (const moduleData of outline.modules) {
    const moduleNode = createNode("module", root.id, {
      title: moduleData.title,
      description: moduleData.description,
      origin: moduleData.inferred ? "ai-inferred" : "ai",
    });
    nodes[moduleNode.id] = moduleNode;
    root.childIds.push(moduleNode.id);

    for (const topicData of moduleData.topics) {
      const topicNode = createNode("topic", moduleNode.id, {
        title: topicData.title,
        description: topicData.description,
        origin: topicData.inferred ? "ai-inferred" : "ai",
      });
      nodes[topicNode.id] = topicNode;
      moduleNode.childIds.push(topicNode.id);
    }
  }

  return { rootId: root.id, nodes };
}
