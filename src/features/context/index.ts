/**
 * Public surface of the context feature.
 * @module
 */

export {
  CONTEXTS_DIR_NAME, DEFAULT_CONTEXT_ID, applySelection, defaultWorkspace,
  listSelections, readSelection, selectionPath, toggleSelection, workspaceOf, writeSelection,
} from './engine.ts'
export type { ContextEngineDeps, ContextSelection } from './engine.ts'
export { applyToAgent, buildSkillSelectTool } from './tools.ts'
export type { AgentLike } from './tools.ts'
export { contextRoutes } from './routes.ts'
export type { ContextRouteDeps } from './routes.ts'
