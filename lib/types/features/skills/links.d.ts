/**
 * The link ledger (`S-M-C/skills-links.json`) — group 4's bookkeeping.
 *
 * Every junction this plugin creates is written down here, because a link on
 * disk carries no memory of why it exists. The ledger is what makes the UI able
 * to tell a link *we* made (safe to rebuild, safe to remove) from one somebody
 * else made (a red flag the user has to decide about) — and it is the only
 * reason a store relocation can repair its links instead of orphaning them.
 *
 * Link paths are compared case-folded, matching the underlying filesystem on
 * Windows where the same path has many spellings.
 * @module
 */
import type { LinkRecord, SkillLinks } from '../../shared/protocol/index.ts';
/** An empty ledger. */
export declare function emptyLinks(): SkillLinks;
/** Read the link ledger, tolerating a missing or corrupt file. */
export declare function readLinks(): SkillLinks;
/** Write the link ledger atomically. */
export declare function writeLinks(links: SkillLinks): void;
/** Ledger record for one link path, when present. */
export declare function linkRecordOf(linkPath: string): LinkRecord | undefined;
/** Append one ledger record (replacing any record for the same link path). */
export declare function trackLink(record: LinkRecord): void;
/** Remove the ledger record for one link path; a no-op when there is none. */
export declare function untrackLink(linkPath: string): void;
/** Fold a path for comparison: case-insensitive on Windows, as-is elsewhere. */
export declare function fold(p: string): string;
//# sourceMappingURL=links.d.ts.map