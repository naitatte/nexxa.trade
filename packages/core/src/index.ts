/**
 * Core business logic package for NexxaTrade
 * 
 * Feature-based architecture: each feature contains all related
 * business logic, types, and utilities in one place for easy iteration.
 */

// Export features
export * from "./features";

// Export shared utilities (only truly shared code)
export * from "./shared";
