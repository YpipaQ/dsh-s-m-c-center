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
/**
 * How one conversation differs from the workspace default.
 *
 * A conversation file records **only the difference**, never the whole set. The
 * default is what a conversation starts from, so editing it has to reach every
 * conversation that never asked for anything else. Storing the pinned set
 * instead — what this module did before — froze the default of that moment into
 * the conversation on its first flip, and no later edit to the default could
 * turn those skills off again ("技能永远关不上").
 */
export interface ContextOverrides {
    /** Slugs this conversation adds on top of the default. */
    on: string[];
    /** Slugs this conversation withholds from the default. */
    off: string[];
}
/** Per-conversation selection document. */
export interface ContextSelection {
    sessionId: string;
    /** The effective slug set — what the engine installs, in pick order. */
    selected: string[];
    updatedAt: string;
    /** Conversation files only: the diff from the default that made `selected`. */
    overrides?: ContextOverrides;
    /** Whether the conversation has a file of its own (false = pure default). */
    configured?: boolean;
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
 * Read one conversation's selection: the default with the conversation's own
 * diff applied, or the empty selection when there is neither.
 *
 * A file written by an older version carries a pinned `selected` and no
 * `overrides`; it is read as a diff against the *current* default, which is what
 * lets such a conversation follow later edits (see {@link normaliseSelection}
 * for making that permanent on disk). Tolerates a missing or corrupt file — a
 * broken selection must never take down the plugin or the conversation.
 */
export declare function readSelection(workspaceRoot: string, sessionId: string): ContextSelection;
/** The diff that turns `base` into `selected` — the only thing a file stores. */
export declare function diffAgainst(base: string[], selected: string[]): ContextOverrides;
/**
 * Write one conversation's selection atomically (tmp + rename).
 *
 * Only the fields this version owns reach the file: a default keeps its full
 * `selected`, a conversation keeps its diff. A caller that hands over a whole
 * set without a diff gets one derived here — "this conversation selects exactly
 * these" is then stored as the difference from the default, which is what keeps
 * later default edits reaching the skills it never ruled on. `stamp: false`
 * preserves the stored `updatedAt` for a structural rewrite, which is not a
 * user edit.
 */
export declare function writeSelection(workspaceRoot: string, selection: ContextSelection, options?: {
    stamp?: boolean;
}): void;
/** Path of one conversation's selection document. */
export declare function selectionPath(workspaceRoot: string, sessionId: string): string;
/**
 * The selection that would result from setting one slug on or off, **without
 * writing anything**.
 *
 * A conversation without a file of its own plans from the default, and the
 * result is expressed as a diff against it — so a conversation that only ever
 * turned one skill off keeps following every other default change. Persisting
 * the whole set here is what used to freeze the default into the conversation.
 *
 * @param selected - the desired state. Omit it to flip whatever is there.
 */
export declare function planSelection(workspaceRoot: string, sessionId: string, slug: string, selected?: boolean): ContextSelection;
/**
 * Rewrite one conversation's file in the current shape (a diff, not a pinned
 * set); answers whether anything was written.
 *
 * Called when a panel reads a conversation, so a file an older version wrote
 * stops pinning the default from the moment it is looked at — no bulk migration
 * over workspaces we would have to guess at.
 */
export declare function normaliseSelection(workspaceRoot: string, sessionId: string): boolean;
/**
 * Drop a conversation's file, so it follows the default again.
 * @returns the selection it now inherits.
 */
export declare function resetSelection(workspaceRoot: string, sessionId: string): ContextSelection;
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