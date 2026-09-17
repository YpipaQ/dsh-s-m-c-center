/**
 * The conversation context engine — the per-conversation selection layer.
 *
 * One job: keep `<workspace>/.dsh/S-M-C/contexts/<sessionId>.json` in step with
 * the skills each conversation has chosen. *Applying* that choice to a live
 * agent is a separate concern with its own module (`./apply.ts`), because it
 * needs cordis fiber lifetimes; this file stays pure filesystem + arithmetic.
 *
 * The write is deliberately split from the decision so a caller can apply a
 * change to a live conversation **first** and only persist once that worked:
 *
 *   planSelection()   read + decide   — writes nothing
 *   commitSelection() persist         — writes the decided document
 *
 * A caller that persists first cannot undo it when the apply fails, which left
 * the UI showing "enabled" for something the agent could not see.
 *
 * Guarantees:
 * - A conversation with no selection file inherits the workspace default
 *   (`contexts/_default.json`, edited through the panel's 默认配置 row); with
 *   no default file either it sees no managed skill through this engine
 *   (official roots keep working as dsh ships them).
 * - SKILL.md files are never touched; the choice lives in the JSON per
 *   conversation, so two conversations can hold different selections at once.
 * - The agent toggles through the registered `skill_select` tool, which writes
 *   the same JSON the panel writes — UI and agent always agree.
 * @module
 */
/** Directory (inside the workspace) that holds per-conversation selections. */
export declare const CONTEXTS_DIR_NAME = "contexts";
/**
 * Session id the workspace default selection lives under. A conversation
 * without a selection file of its own inherits this selection, so the panel's
 * default row is "the skills new conversations start with". Real dsh session
 * ids never look like this.
 */
export declare const DEFAULT_CONTEXT_ID = "_default";
/** Per-conversation selection document. */
export interface ContextSelection {
    sessionId: string;
    /** Selected skill slugs (store / registry identity), in pick order. */
    selected: string[];
    updatedAt: string;
}
/** One row of the panel's conversation index. */
export interface SelectionRow {
    sessionId: string;
    count: number;
    updatedAt: string;
}
/** A file in the contexts directory that is not a conversation selection. */
export interface IgnoredSelection {
    name: string;
    /** Why it was skipped. Today a single reason exists; more are expected. */
    reason: 'reserved';
}
/**
 * Read one conversation's selection: its own file when it has one, otherwise
 * the workspace default, otherwise the empty selection. The fallback is what
 * makes the panel's 默认配置 row real — a fresh conversation starts with the
 * default picks already registered. Tolerates a missing or corrupt file — a
 * broken selection must never take down the plugin or the conversation.
 */
export declare function readSelection(workspaceRoot: string, sessionId: string): ContextSelection;
/** Write one conversation's selection atomically (tmp + rename). */
export declare function writeSelection(workspaceRoot: string, selection: ContextSelection): void;
/** Path of one conversation's selection document. */
export declare function selectionPath(workspaceRoot: string, sessionId: string): string;
/**
 * The selection that would result from setting one slug on or off, **without
 * writing anything**.
 *
 * A conversation without its own file plans from the inherited default, so its
 * first commit pins the inherited picks plus the change — that is what makes
 * "the default is just a starting point" true.
 *
 * @param selected - the desired state. Omit it to flip whatever is there.
 */
export declare function planSelection(workspaceRoot: string, sessionId: string, slug: string, selected?: boolean): ContextSelection;
/** Persist a planned selection. The only writer in this module. */
export declare function commitSelection(workspaceRoot: string, selection: ContextSelection): void;
/**
 * Plan and persist in one step (the convenience form).
 * Prefer {@link planSelection} + {@link commitSelection} where the caller has a
 * live agent to apply to first.
 */
export declare function toggleSelection(workspaceRoot: string, sessionId: string, slug: string): ContextSelection;
/**
 * Read one workspace's selection index: the default row, every conversation
 * that holds a file, and the files that were skipped.
 *
 * Reserved names are reported rather than silently dropped: a stray
 * `default.json` looks like a conversation, and the last time one appeared it
 * was taken for a schema migration. Naming it in `ignored` is what stops that.
 */
export declare function readContextIndex(workspaceRoot: string): {
    selections: SelectionRow[];
    ignored: IgnoredSelection[];
};
/** The conversation rows alone — the index's original shape. */
export declare function listSelections(workspaceRoot: string): SelectionRow[];
/** Workspace root for a cwd: the nearest .git ancestor (dsh's own rule). */
export declare function workspaceOf(cwd?: string): string;
/** Read-only snapshot combining the selection with resolvable rows (panel). */
export declare function selectionDetail(workspaceRoot: string, sessionId: string): ContextSelection;
/** Default workspace fallback used by routes without an explicit cwd. */
export declare function defaultWorkspace(): string;
//# sourceMappingURL=engine.d.ts.map