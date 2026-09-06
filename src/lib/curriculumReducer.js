import { LEVELS } from "./levels";
import { createNode, collectDescendants } from "./nodes";

/**
 * The only function in the app that knows how to turn "what happened"
 * (an action) into the next state. Every case must return a brand-new
 * state object — never mutate `state` or anything inside it, or React
 * won't notice the change and the screen will silently fail to update.
 */
export function curriculumReducer(state, action) {
  switch (action.type) {
    case "UPDATE_FIELD": {
      const { id, field, value } = action;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [id]: { ...state.nodes[id], [field]: value },
        },
      };
    }

    case "ADD_CHILD": {
      const { parentId } = action;
      const parent = state.nodes[parentId];
      const childType = LEVELS[parent.type].child;
      if (!childType) return state; // lessons have no child type

      const child = createNode(childType, parentId);

      return {
        ...state,
        nodes: {
          ...state.nodes,
          [child.id]: child,
          [parentId]: { ...parent, childIds: [...parent.childIds, child.id] },
        },
      };
    }

    case "DELETE_NODE": {
      const { id } = action;
      const node = state.nodes[id];
      if (!node.parentId) return state; // the root can't be deleted

      const snapshot = { rootId: state.rootId, nodes: state.nodes };
      const idsToRemove = collectDescendants(state.nodes, id);

      const nodes = { ...state.nodes };
      for (const removeId of idsToRemove) {
        delete nodes[removeId];
      }

      const parent = nodes[node.parentId];
      nodes[node.parentId] = {
        ...parent,
        childIds: parent.childIds.filter((childId) => childId !== id),
      };

      return { ...state, nodes, history: [...state.history, snapshot] };
    }

    case "TOGGLE_COLLAPSE": {
      const { id } = action;
      const collapsed = new Set(state.collapsed);
      if (collapsed.has(id)) {
        collapsed.delete(id);
      } else {
        collapsed.add(id);
      }
      return { ...state, collapsed };
    }

    case "SET_COLLAPSE_ALL": {
      if (!action.collapsed) {
        return { ...state, collapsed: new Set() };
      }
      const collapsibleIds = Object.values(state.nodes)
        .filter((node) => LEVELS[node.type].child !== null)
        .map((node) => node.id);
      return { ...state, collapsed: new Set(collapsibleIds) };
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        ...state,
        rootId: previous.rootId,
        nodes: previous.nodes,
        history: state.history.slice(0, -1),
      };
    }

    case "REPLACE_TREE": {
      const snapshot = { rootId: state.rootId, nodes: state.nodes };
      return {
        ...state,
        rootId: action.rootId,
        nodes: action.nodes,
        history: [...state.history, snapshot],
      };
    }

    case "MERGE_TREE": {
      const { nodes: incomingNodes, intoId } = action;
      const snapshot = { rootId: state.rootId, nodes: state.nodes };

      // Only nodes whose parentId already points at intoId are the new
      // top-level items (e.g. new modules) — everything else in
      // incomingNodes is a descendant of one of those, already wired up.
      const topLevelIds = Object.values(incomingNodes)
        .filter((node) => node.parentId === intoId)
        .map((node) => node.id);

      const target = state.nodes[intoId];

      return {
        ...state,
        nodes: {
          ...state.nodes,
          ...incomingNodes,
          [intoId]: { ...target, childIds: [...target.childIds, ...topLevelIds] },
        },
        history: [...state.history, snapshot],
      };
    }

    case "ATTACH_LESSONS": {
      const { topicId, lessons } = action;
      const topic = state.nodes[topicId];
      // The topic can vanish between "Pass 2 request sent" and "Pass 2
      // response arrives" if the user deletes it mid-flight. Silently
      // drop the result rather than crash on a topic that's gone.
      if (!topic) return state;

      const newNodes = {};
      const newIds = [];
      for (const lesson of lessons) {
        const node = createNode("lesson", topicId, {
          title: lesson.title,
          description: lesson.description,
          origin: lesson.inferred ? "ai-inferred" : "ai",
        });
        newNodes[node.id] = node;
        newIds.push(node.id);
      }

      return {
        ...state,
        nodes: {
          ...state.nodes,
          ...newNodes,
          [topicId]: { ...topic, childIds: [...topic.childIds, ...newIds] },
        },
      };
    }

    default:
      return state;
  }
}
