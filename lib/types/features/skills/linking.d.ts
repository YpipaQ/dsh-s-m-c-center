/**
 * Creating, removing and verifying the `~/.dsh/skills/<slug>` links.
 *
 * A link is how a skill that lives in the store (or in some external directory)
 * becomes visible to the agent, which only scans dsh's own roots. Every create
 * writes a ledger record in the same step, so the pair can never drift into the
 * "link on disk, no record" state the UI reports as a red flag.
 *
 * Windows needs junctions rather than symlinks: a junction needs no elevation
 * and no developer mode, and it is removed with `rmdirSync`.
 * @module
 */
import type { VerifyResult } from '../../shared/protocol/index.ts';
/** Link kind: junctions need no elevation on Windows, symlinks elsewhere. */
export declare const LINK_TYPE: string;
/** The link path for one slug, under dsh's own skills root. */
export declare function linkPathOf(slug: string): string;
/**
 * Whether a link exists for one slug — the same question the scanner asks when
 * it decides a row's `linked` flag.
 */
export declare function linkedPathOf(slug: string): string | undefined;
/**
 * Create the link `~/.dsh/skills/<slug>` → `target` and write the ledger
 * record. Refuses to overwrite a real directory; an existing link is a no-op.
 */
export declare function createLink(slug: string, target: string): void;
/**
 * Remove the link `~/.dsh/skills/<slug>` and its ledger record. Only ever
 * removes a link — a real directory is left alone so a stray path can never
 * delete real skills.
 */
export declare function removeLink(slug: string): void;
/**
 * Remove a link at an explicit path (the untracked-link case, where the slug is
 * not what is on disk).
 */
export declare function removeLinkAt(linkPath: string): void;
/**
 * Repoint every ledger-tracked link that targets `from` at `to`.
 *
 * A junction stores an absolute target string, so moving the store silently
 * breaks every link into it. This is the repair step the store-root migration
 * runs right after moving. Links the ledger never saw get a repair pass too —
 * they point into the same directory, so they share the problem.
 * @returns how many links were rebuilt.
 */
export declare function relinkSkills(from: string, to: string): number;
/**
 * Verify a link: does it still resolve, and does the target still hold an
 * admission document (SKILL.md or DESCRIPTION.md)? Used by the UI for
 * red-flagged (untracked) links.
 */
export declare function verifyLink(slugOrPath: string): VerifyResult;
/**
 * Create (or confirm) the link for a stored or registered skill.
 *
 * A store slug links straight at its store copy; a registered slug links at its
 * external directory, or at the directory holding the flat `.md` file.
 */
export declare function linkSkill(slug: string): void;
/** Remove the link for a skill (the canonical copy is never touched). */
export declare function unlinkSkill(slug: string): void;
/**
 * Delete a link the ledger has no record of (the red-flag row's action).
 * Refuses a tracked link so the normal unlink stays the only path that also
 * clears the ledger record.
 */
export declare function deleteUntrackedLink(linkPath: string): void;
/** Resolve a link path back to the skill it serves, or undefined. */
export declare function resolveByLink(linkPath: string): {
    slug: string;
    target: string;
} | undefined;
//# sourceMappingURL=linking.d.ts.map