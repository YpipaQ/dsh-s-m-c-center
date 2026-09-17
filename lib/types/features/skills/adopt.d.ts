/**
 * Adoption: moving a native skill into the store (and undoing it).
 *
 * This is the only flow that relocates a user's files, so the rules are strict:
 * the SKILL.md is copied verbatim — never rewritten, not even the frontmatter —
 * a link is left in the original's place so the agent keeps seeing the skill,
 * and the origin is recorded so the whole thing can be undone.
 *
 * Adoption is reserved for user-level skills. A project skill belongs to its
 * repository and is never moved.
 * @module
 */
import type { SkillSource } from '../../shared/protocol/index.ts';
/**
 * Move one native skill into the store, link it back from
 * `~/.dsh/skills/<slug>`, record the link, and drop its registry entry (the
 * skill is a stored one now). The SKILL.md is copied verbatim — no frontmatter
 * rewriting, ever.
 *
 * `source` names the root the skill came from and is carried for the caller's
 * own bookkeeping; the manifest records the path, which is what an unmigrate
 * needs.
 * @returns the store slug.
 */
export declare function migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string;
/**
 * Undo a migration: remove the link, move the canonical copy back to its
 * origin, and drop the manifest entry. The registry entry is restored so the
 * announcement flag survives the round trip.
 * @returns the path the skill was restored to.
 */
export declare function unmigrate(slug: string): string;
//# sourceMappingURL=adopt.d.ts.map