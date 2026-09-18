/**
 * Public surface of the context feature.
 *
 * The selection state is one relay document (see `./table.ts`); the API here is
 * keyed by session id and never asks for a workspace.
 * @module
 */

export {
  CONTEXTS_DIR_NAME, DEFAULT_CONTEXT_ID, applyOverrides, commitSelection, contextTablePath,
  diffAgainst, importLegacyContexts, legacyContextCandidates, legacySelectionDir, listSelections,
  planSelection, readContextIndex, readSelection, resetSelection, toggleSelection, writeSelection,
} from './engine.ts'
export type {
  ContextOverrides, ContextSelection, ContextTable, ContextTableEntry, IgnoredSelection,
  LegacyImportReport, SelectionRow,
} from './engine.ts'
  export { SkillBindings } from './apply.ts'
  export type { ApplyOutcome } from './apply.ts'
  export {
    applyToAgent, buildSkillQueryTool, buildSkillSelectTool, missingSlugs, withoutMissing,
    workspaceOfAgent,
  } from './tools.ts'
  export type { AgentLike } from './tools.ts'
  export {
    CATALOG_KIND, attachSmcCatalog, buildShadowSkillTool, catalogEntriesFor, nextCatalogDecision,
    renderSmcCatalog, smcDigest,
  } from './shadow.ts'
  export type { CatalogEntry, SmcCatalogSource } from './shadow.ts'
  export { contextRoutes } from './routes.ts'
  export type { ContextRouteDeps } from './routes.ts'
