/**
 * Registry operations: importing external skills, dropping them, and the
 * traceability pass.
 *
 * The registry is the ledger for skills that stay where they are, so these are
 * the flows that do *not* move anything — importing records a path, and the
 * refresh pass only checks whether that path is still there.
 * @module
 */
import type { RegistryEntry, SkillSummary } from '../../shared/protocol/index.ts';
/**
 * Register external skills: the canonical copy stays where it is, only a
 * record goes into `skills-registry.json`. This is the flow for "skills in
 * arbitrary directories" per the four-group model.
 *
 * Per-item failures are collected rather than thrown, so one bad pick does not
 * abandon the rest of the batch.
 */
export declare function registerExternal(items: Array<{
    sourcePath: string;
    kind: 'bundle' | 'file';
}>): Array<{
    name: string;
    ok: boolean;
    reason?: string;
}>;
/** Drop a registry entry (and its link, when one exists). */
export declare function unregisterExternal(slug: string): void;
/**
 * One registry entry's traceability verdict.
 *
 * `ok` is the whole story for the UI (a row is either traceable or flagged),
 * while `reason` and `mdPath` are what make a failure *actionable*: "the record
 * has no row in the list at all" and "the directory is there but the skill
 * inside it was deleted" call for different repairs.
 */
export interface TraceResult {
    slug: string;
    name: string;
    ok: boolean;
    /** Why it failed, when it did; '' when healthy. */
    reason: string;
    /** The admission document the entry resolves to, when healthy. */
    mdPath?: string;
}
/** One traceability pass: what survived on disk, and what was dropped as an orphan. */
export interface RefreshResult {
    /** One verdict per record that had a row to trace. */
    results: TraceResult[];
    /** How many ledger records were dropped for having no row in the list. */
    pruned: number;
}
/**
 * Walk the registry and refresh every entry's traceability verdict, persisting
 * the outcome: `lastSeen` when the skill is still there, `missing` (with its
 * reason) when it is not.
 *
 * The pass runs in two stages, and they do different things because the two
 * failures are different in kind:
 *
 * 1. **Is there a row at all?** A record whose slug does not appear in the list
 *    is **dropped**. Nothing points at it, so it can never be shown, linked or
 *    loaded — it is not a broken skill, it is no skill. Keeping it flagged would
 *    bury the real problems under records no user can act on. This is settled
 *    from the list alone, with no filesystem work: the disk is not the authority
 *    here, the list is. (A `native` entry from another workspace lands here
 *    naturally — it is scanned into the list only while its own project is open,
 *    so outside it the record has no row and goes. No special case needed.)
 * 2. **Does it still resolve?** Only for records that *do* have a row: the path
 *    is checked for existence and for a document, and a failure is written onto
 *    the row.
 *
 * Persisting the *failure* is the point of stage 2. A verdict that only lives in
 * the toast disappears with the click, and the stale row then reads as healthy
 * again on the next mount — the panel offers to link a skill that cannot be
 * linked. Writing it onto the row makes the flag survive reloads until a
 * refresh clears it.
 *
 * @param rows - the skills currently listed. Defaults to a fresh scan.
 * @returns one verdict per *surviving* record, plus how many orphans were
 * dropped — the count is worth showing, because a user whose ledger quietly
 * shrank should be told rather than left to notice.
 */
export declare function refreshRegistry(rows?: SkillSummary[]): RefreshResult;
/**
 * The registry entry a given skill path belongs to, for the delete flow.
 *
 * Matches the entry's own directory (so a bundle's SKILL.md resolves to it) or
 * the path itself (a flat `.md` row).
 */
export declare function registryEntryForDelete(path: string): RegistryEntry | undefined;
//# sourceMappingURL=registry-ops.d.ts.map