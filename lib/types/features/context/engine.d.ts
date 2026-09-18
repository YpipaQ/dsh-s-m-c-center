/**
 * The conversation context engine — which skills each conversation has enabled.
 *
 * One job: keep the **relay table** (`$STORE_ROOT/contexts.json`, see
 * `./table.ts`) in step with the skills each conversation has chosen.
 * *Applying* that choice to a live agent is a separate concern with its own
 * module (`./apply.ts`), because it needs cordis fiber lifetimes; this file
 * stays pure arithmetic over one document.
 *
 * The write is deliberately split from the decision so a caller can apply a
 * change to a live conversation **first** and only persist once that worked:
 *
 *   planSelection()   read + decide   — writes nothing
 *   commitSelection() persist         — writes the decided row
 *
 * A caller that persists first cannot undo it when the apply fails, which left
 * the UI showing "enabled" for something the agent could not see.
 *
 * Guarantees:
 * - A conversation with no row of its own inherits the default (the panel's
 *   会话默认 card); with no default either it sees no managed skill through this
 *   engine (dsh's own roots keep working as dsh ships them).
 * - **No workspace is involved.** The key is the session id, which is unique on
 *   its own, so two panels asking about the same conversation always read the
 *   same bytes. This is the whole point of the table: the old per-workspace
 *   files made the answer depend on resolving a directory, and two callers
 *   resolved differently.
 * - SKILL.md files are never touched; the choice lives in the table, so two
 *   conversations can hold different selections at once.
 * - The agent toggles through the registered `skill_select` tool, which writes
 *   the same table the panel writes — UI and agent always agree.
 * @module
 */
import type { ContextOverrides } from './table.ts';
export { applyOverrides, contextTablePath, diffAgainst, } from './table.ts';
export type { ContextOverrides, ContextTable, ContextTableEntry } from './table.ts';
/**
 * Directory name an older version kept per-conversation selections in, inside
 * each workspace. Read only by {@link importLegacyContexts}; nothing writes it
 * any more.
 */
export declare const CONTEXTS_DIR_NAME = "contexts";
/**
 * Session id the default selection lives under. A conversation without a row of
 * its own inherits this selection, so the panel's 会话默认 card is "the skills a
 * new conversation starts with". Real dsh session ids never look like this.
 */
export declare const DEFAULT_CONTEXT_ID = "_default";
/** Per-conversation selection, resolved (not the stored row). */
export interface ContextSelection {
    sessionId: string;
    /** The effective slug set — what the engine installs, in pick order. */
    selected: string[];
    updatedAt: string;
    /** Conversation rows only: the diff from the default that made `selected`. */
    overrides?: ContextOverrides;
    /** Whether the conversation has a row of its own (false = pure default). */
    configured?: boolean;
}
/** One row of the panel's conversation index. */
export interface SelectionRow {
    sessionId: string;
    count: number;
    updatedAt: string;
}
/** A table row that is not a conversation selection. */
export interface IgnoredSelection {
    name: string;
    /** Why it was skipped. Today a single reason exists; more are expected. */
    reason: 'reserved';
}
/**
 * Read one conversation's selection: the default with the conversation's own
 * diff applied, or the default alone when it has no row.
 *
 * Tolerates a missing or corrupt table — a broken selection must never take
 * down the plugin or a conversation.
 */
export declare function readSelection(sessionId: string): ContextSelection;
/**
 * Write one conversation's selection.
 *
 * Only the fields this version owns reach the file: the default keeps its full
 * `selected`, a conversation keeps its diff. A caller that hands over a whole
 * set without a diff gets one derived here — "this conversation selects exactly
 * these" is then stored as the difference from the default, which is what keeps
 * later default edits reaching the skills it never ruled on. `stamp: false`
 * preserves the stored `updatedAt` for a structural rewrite, which is not a
 * user edit.
 */
export declare function writeSelection(selection: ContextSelection, options?: {
    stamp?: boolean;
}): void;
/**
 * The selection that would result from setting one slug on or off, **without
 * writing anything**.
 *
 * A conversation without a row of its own plans from the default, and the
 * result is expressed as a diff against it — so a conversation that only ever
 * turned one skill off keeps following every other default change.
 *
 * @param selected - the desired state. Omit it to flip whatever is there.
 */
export declare function planSelection(sessionId: string, slug: string, selected?: boolean): ContextSelection;
/** Persist a planned selection. The only writer besides {@link writeSelection}. */
export declare function commitSelection(selection: ContextSelection): void;
/**
 * Drop a conversation's row, so it follows the default again.
 * @returns the selection it now inherits.
 */
export declare function resetSelection(sessionId: string): ContextSelection;
/**
 * Plan and persist in one step (the convenience form).
 * Prefer {@link planSelection} + {@link commitSelection} where the caller has a
 * live agent to apply to first.
 */
export declare function toggleSelection(sessionId: string, slug: string): ContextSelection;
/**
 * The selection index: the default row first, then every conversation that
 * holds a row (newest first), plus the rows that were skipped.
 *
 * Reserved names are reported rather than silently dropped: a stray `default`
 * row looks like a conversation, and the last time one appeared it was taken
 * for a schema migration. Naming it in `ignored` is what stops that.
 */
export declare function readContextIndex(): {
    selections: SelectionRow[];
    ignored: IgnoredSelection[];
};
/** The conversation rows plus the default — the index's flat shape. */
export declare function listSelections(): SelectionRow[];
/** Path of one workspace's legacy selection directory (import only). */
export declare function legacySelectionDir(workspaceRoot: string): string;
/**
 * Directories that may still hold a pre-table layout, for the one-shot import.
 *
 * Deliberately a short, predictable list rather than a disk walk: the current
 * directory, its project root, its volume root (which is where a workspace
 * without a project marker used to file its state) and the dsh home. Guessing
 * less means the import cannot wander into an unrelated tree.
 */
export declare function legacyContextCandidates(): string[];
/** What the one-shot import did — reported, never guessed at. */
export interface LegacyImportReport {
    /** Whether the table was created (false when one already existed). */
    ran: boolean;
    /** Directories that held a legacy layout. */
    dirs: string[];
    /** Where the imported default came from ('' when none was found). */
    defaultFrom: string;
    /** The default it imported. */
    defaultSelected: string[];
    /** Conversation ids imported. */
    sessions: string[];
    /** Files skipped, with why. */
    skipped: string[];
}
/**
 * Fold an older per-workspace layout into the table — **once**.
 *
 * Runs only when the table does not exist yet, so the migration cannot fight
 * with live state: after the first mount the table is the truth and these files
 * are just leftovers. The `default` files of several workspaces collapse into
 * one, so the winner is the most recently written (ties broken by the fuller
 * one) and the choice is reported rather than silently made.
 *
 * Effective selections are preserved: a conversation's stored set becomes a
 * diff against the default that was just imported, so nothing a user had turned
 * on or off changes meaning.
 */
export declare function importLegacyContexts(dirs: string[], options?: {
    force?: boolean;
}): LegacyImportReport;
//# sourceMappingURL=engine.d.ts.map