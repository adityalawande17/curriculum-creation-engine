/**
 * One entry per node type. Everything level-specific (what a node's
 * children are called, what the "Add" button should say, how deep it is)
 * lives here instead of being hardcoded across components.
 *
 * Adding a new level to the hierarchy later = adding one entry here.
 */
export const LEVELS = {
  curriculum: {
    child: "module",
    label: "Curriculum",
    addLabel: "Add Module",
    depth: 0,
  },
  module: {
    child: "topic",
    label: "Module",
    addLabel: "Add Topic",
    depth: 1,
  },
  topic: {
    child: "lesson",
    label: "Topic",
    addLabel: "Add Lesson",
    depth: 2,
  },
  lesson: {
    child: null,
    label: "Lesson",
    addLabel: null,
    depth: 3,
  },
};
