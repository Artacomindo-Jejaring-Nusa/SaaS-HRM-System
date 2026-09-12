/// <reference types="cypress" />

import "./commands";

// Suppress uncaught hydration and ResizeObserver errors that don't affect E2E test correctness
Cypress.on("uncaught:exception", (err, runnable) => {
  if (
    err.message.includes("Hydration failed") ||
    err.message.includes("There was an error while hydrating") ||
    err.message.includes("ResizeObserver loop") ||
    err.message.includes("NEXT_REDIRECT") ||
    err.message.includes("canceled") ||
    err.message.includes("Script error")
  ) {
    return false;
  }
  return true;
});
