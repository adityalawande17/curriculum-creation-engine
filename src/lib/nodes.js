/**
 * @typedef {Object} Node
 * @property {string} id
 * @property {"curriculum"|"module"|"topic"|"lesson"} type
 * @property {string} title
 * @property {string} description
 * @property {string[]} childIds
 * @property {string|null} parentId
 * @property {"manual"|"ai"|"ai-inferred"} origin
 */

export function newId() {
  return crypto.randomUUID();
}

/**
 * Builds a correctly-shaped Node. `overrides` lets a caller set a specific
 * title/description (e.g. from AI output) instead of the defaults.
 * @param {Node["type"]} type
 * @param {string|null} parentId
 * @param {Partial<Node>} [overrides]
 * @returns {Node}
 */
export function createNode(type, parentId, overrides = {}) {
  return {
    id: newId(),
    type,
    title: "",
    description: "",
    childIds: [],
    parentId,
    origin: "manual",
    ...overrides,
  };
}

/**
 * The state the app starts in: one root curriculum node, nothing else.
 *
 * The root always gets the fixed id "root" rather than a random one from
 * createNode(). A random id here would be generated once during Next.js's
 * server render and again during browser hydration — two different
 * values for the same node, which React reports as a hydration mismatch.
 * A fixed id is identical both times, so there's nothing to mismatch.
 */
export function createInitialState() {
  const root = {
    id: "root",
    type: "curriculum",
    title: "Untitled Curriculum",
    description: "",
    childIds: [],
    parentId: null,
    origin: "manual",
  };
  return {
    rootId: root.id,
    nodes: { [root.id]: root },
    collapsed: new Set(),
    history: [],
  };
}

/**
 * Returns [id, ...every descendant id], so DELETE_NODE knows the full set
 * of entries to remove from the nodes map.
 *
 * Written with an explicit stack instead of a recursive function: a
 * recursive version would call itself once per level of depth, and a
 * pathological 300-node curriculum could theoretically be deep enough to
 * matter. A `while` loop with its own array-as-stack has no call-stack
 * limit and is just as easy to read.
 *
 * @param {Record<string, Node>} nodes
 * @param {string} id
 * @returns {string[]}
 */
export function collectDescendants(nodes, id) {
  const result = [];
  const stack = [id];

  while (stack.length > 0) {
    const currentId = stack.pop();
    result.push(currentId);
    const current = nodes[currentId];
    stack.push(...current.childIds);
  }

  return result;
}

function countTypes(nodes, ids) {
  const counts = { modules: 0, topics: 0, lessons: 0 };
  for (const id of ids) {
    const node = nodes[id];
    if (node.type === "module") counts.modules++;
    if (node.type === "topic") counts.topics++;
    if (node.type === "lesson") counts.lessons++;
  }
  return counts;
}

/**
 * Counts nodes by type across the whole tree, for the header stats.
 * @param {Record<string, Node>} nodes
 */
export function countByType(nodes) {
  return countTypes(nodes, Object.keys(nodes));
}

/**
 * Counts nodes by type within one node's subtree only (not including the
 * node itself) — for a collapsed row's summary, e.g. "4 topics · 11 lessons".
 * @param {Record<string, Node>} nodes
 * @param {string} id
 */
export function countDescendantsByType(nodes, id) {
  const descendantIds = collectDescendants(nodes, id).filter((d) => d !== id);
  return countTypes(nodes, descendantIds);
}
