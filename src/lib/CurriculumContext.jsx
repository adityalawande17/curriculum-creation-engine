"use client";

import { createContext, useContext } from "react";

// Empty by default — real value only exists once CurriculumProvider
// supplies one. If some component tries to read it without a Provider
// above it in the tree, useCurriculumContext() below throws immediately
// instead of silently returning nothing.
const CurriculumContext = createContext(null);

/**
 * Wrap the tree once, at the top (page.js), with the single result of
 * calling useCurriculum(). Everything inside — no matter how deeply
 * nested — reads that same shared value via useCurriculumContext().
 */
export function CurriculumProvider({ value, children }) {
  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculumContext() {
  const context = useContext(CurriculumContext);
  if (!context) {
    throw new Error("useCurriculumContext must be used inside a CurriculumProvider");
  }
  return context;
}
