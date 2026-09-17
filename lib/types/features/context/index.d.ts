/**
 * Public surface of the context feature.
 * @module
 */
export { CONTEXTS_DIR_NAME, DEFAULT_CONTEXT_ID, commitSelection, defaultWorkspace, listSelections, planSelection, readContextIndex, readSelection, selectionPath, toggleSelection, workspaceOf, writeSelection, } from './engine.ts';
export type { ContextSelection, IgnoredSelection, SelectionRow } from './engine.ts';
export { SkillBindings } from './apply.ts';
export type { ApplyOutcome } from './apply.ts';
export { applyToAgent, buildSkillSelectTool, workspaceOfAgent } from './tools.ts';
export type { AgentLike } from './tools.ts';
export { contextRoutes } from './routes.ts';
export type { ContextRouteDeps } from './routes.ts';
//# sourceMappingURL=index.d.ts.map