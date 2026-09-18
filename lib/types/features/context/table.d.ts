/**
 * The relay table: one document that holds every session-skill selection.
 *
 * ## Why one file instead of one per workspace
 *
 * The selection used to live in `<workspace>/.dsh/S-M-C/contexts/<sessionId>
 * .json`. Reading it therefore required resolving a workspace first, and that
 * resolution was the source of everything that went wrong:
 *
 * - **Two answers to one question.** The settings page asks with the cwd dsh
 *   reports for the page; the sidebar asks for a conversation and gets the
 *   workspace *that conversation* runs in. Same user, same switch, two files.
 * - **State nobody can find.** A workspace with no project marker resolved to
 *   the volume root, so its conversations all shared `G:\.dsh\S-M-C\contexts\`
 *   — and looked like they had no config at all.
 * - **Defaults that could not be turned off.** A conversation's file pinned the
 *   default of the moment it was written, and a later edit to the default
 *   reached only the conversations that had never been touched.
 *
 * The state is per-conversation, and a session id is already unique machine-
 * wide. So the key is the session id and the file is one: nothing has to guess
 * a directory, and both panels read the same bytes. Files are still read for
 * the one-shot import of an older layout — see `importLegacyContexts` in
 * `./engine.ts` — but nothing new is ever written per workspace again.
 *
 * ## Shape
 *
 * ```json
 * {
 *   "version": 1,
 *   "default":  { "selected": ["gsap"], "updatedAt": "..." },
 *   "sessions": { "<sessionId>": { "on": ["x"], "off": ["y"], "updatedAt": "..." } }
 * }
 * ```
 *
 * `default` is the starting set for every conversation; a session entry is
 * **only the difference** from it (additions `on`, withholdings `off`), so
 * editing the default reaches every conversation that never ruled on a skill
 * itself.
 *
 * This module is storage plus pure arithmetic. Deciding *what* a conversation
 * selects — and the one-shot import — is `./engine.ts`.
 * @module
 */
/** Schema version written into the document; a later version may migrate it. */
export declare const CONTEXT_TABLE_VERSION = 1;
/** How one conversation differs from the default. */
export interface ContextOverrides {
    /** Slugs this conversation adds on top of the default. */
    on: string[];
    /** Slugs this conversation withholds from the default. */
    off: string[];
}
/** One conversation's row: the diff, plus when it was last written. */
export interface ContextTableEntry extends ContextOverrides {
    updatedAt: string;
}
/** The whole document. */
export interface ContextTable {
    version: number;
    default: {
        selected: string[];
        updatedAt: string;
    };
    sessions: Record<string, ContextTableEntry>;
}
/** Where the table lives — surfaced in the UI so the state is findable. */
export declare function contextTablePath(): string;
/**
 * An empty table (no default, no conversations).
 *
 * `sessions` is a **null-prototype** map on purpose. On a plain object,
 * `sessions['__proto__']` answers with `Object.prototype` — a truthy value
 * where the caller asked "is there a row named this?", so such a lookup would
 * be read as a configured conversation.
 */
export declare function emptyTable(): ContextTable;
/**
 * Read the table, tolerating anything.
 *
 * A hand-edited or truncated document must never take down the panel or a
 * conversation: an unreadable table reads as an empty one, and the next write
 * repairs it. Every field is validated here rather than at the call sites, so
 * callers can treat the result as well-formed.
 */
export declare function readContextTable(): ContextTable;
/**
 * Write the table atomically (temp file + rename).
 *
 * Only the keys this version owns reach the file; anything unknown is dropped
 * rather than carried along, so a field an older version wrote cannot sit in a
 * user-visible document looking alive.
 */
export declare function writeContextTable(table: ContextTable): void;
/**
 * Session keys that name the default rather than a conversation.
 *
 * `default` is not produced by this code — the route accepts any string — so it
 * comes from a caller that sent that value. It is reserved because a row named
 * after it looks exactly like a conversation, and one has already been read as
 * such.
 */
export declare function isReservedSessionId(sessionId: string): boolean;
/**
 * Reserved keys actually present in the document.
 *
 * Reported rather than silently dropped: a stray `default` row is a sign that
 * something wrote state under a name this code does not own, and the last time
 * that happened it was mistaken for a schema migration.
 */
export declare function scanReservedSessionKeys(): string[];
/** The default with one conversation's additions and withholdings applied. */
export declare function applyOverrides(base: string[], overrides: ContextOverrides): string[];
/** The diff that turns `base` into `selected` — the only thing a row stores. */
export declare function diffAgainst(base: string[], selected: string[]): ContextOverrides;
/** Read a JSON field as a list of non-empty strings. */
export declare function asStringList(value: unknown): string[];
/** Read a JSON field as text. */
export declare function asText(value: unknown): string;
//# sourceMappingURL=table.d.ts.map