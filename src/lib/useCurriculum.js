"use client";

import { useReducer } from "react";
import { curriculumReducer } from "./curriculumReducer";
import { createInitialState, countByType, newId } from "./nodes";

/**
 * The only door into curriculum state. Components call the named
 * functions below (addChild, deleteNode, ...) and never see `dispatch`
 * or an action object — that keeps every component ignorant of what a
 * Node looks like internally, which is the whole point of D3.
 *
 * `init` defaults to the real starting state (one empty root) but can be
 * swapped — e.g. for the Phase 3 seed data — without touching this file.
 */
export function useCurriculum(init = createInitialState) {
  const [state, dispatch] = useReducer(curriculumReducer, undefined, init);

  const root = state.nodes[state.rootId];

  return {
    state,
    root,
    getNode: (id) => state.nodes[id],

    updateField: (id, field, value) =>
      dispatch({ type: "UPDATE_FIELD", id, field, value }),

    // Returns the new node's id so the caller (page.js) can track "this
    // is the one that should autoFocus" — the reducer never hands
    // anything back, since dispatch's return value is always ignored.
    addChild: (parentId) => {
      const id = newId();
      dispatch({ type: "ADD_CHILD", parentId, id });
      return id;
    },

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
