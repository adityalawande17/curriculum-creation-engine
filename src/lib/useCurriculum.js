"use client";

import { useReducer } from "react";
import { curriculumReducer } from "./curriculumReducer";
import { createInitialState, countByType } from "./nodes";

/**
 * The only door into curriculum state. Components call the named
 * functions below (addChild, deleteNode, ...) and never see `dispatch`
 * or an action object — that keeps every component ignorant of what a
 * Node looks like internally, which is the whole point of D3.
 */
export function useCurriculum() {
  const [state, dispatch] = useReducer(curriculumReducer, undefined, createInitialState);

  const root = state.nodes[state.rootId];

  return {
    state,
    root,
    getNode: (id) => state.nodes[id],

    updateField: (id, field, value) =>
      dispatch({ type: "UPDATE_FIELD", id, field, value }),

    addChild: (parentId) => dispatch({ type: "ADD_CHILD", parentId }),

    deleteNode: (id) => dispatch({ type: "DELETE_NODE", id }),

    toggleCollapse: (id) => dispatch({ type: "TOGGLE_COLLAPSE", id }),

    collapseAll: (collapsed) => dispatch({ type: "SET_COLLAPSE_ALL", collapsed }),

    undo: () => dispatch({ type: "UNDO" }),
    canUndo: state.history.length > 0,

    replaceTree: (tree) =>
      dispatch({ type: "REPLACE_TREE", rootId: tree.rootId, nodes: tree.nodes }),

    mergeTree: (nodes, intoId) => dispatch({ type: "MERGE_TREE", nodes, intoId }),

    attachLessons: (topicId, lessons) =>
      dispatch({ type: "ATTACH_LESSONS", topicId, lessons }),

    stats: countByType(state.nodes),
  };
}
