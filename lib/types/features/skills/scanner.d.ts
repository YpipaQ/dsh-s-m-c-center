/**
 * Listing and scanning: turning the four roots plus three ledgers into rows.
 *
 * The four groups are assembled differently and that is the whole difficulty:
 * `native` rows come from walking real directories, `stored` and `registered`
 * rows come from ledgers (minus the ones the walk already found through a
 * link), and the links themselves are a property of either. The compensation
 * steps below exist so a skill is never listed twice and never dropped just
 * because its link is missing.
 * @module
 */
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
import type { ScannedSkill, SkillDetail, SkillSummary } from '../../shared/protocol/index.ts';
/**
 * List every skill across the four groups, de-duplicated by path: native
 * roots first, then stored-but-unlinked rows, then registered-but-unlinked
 * rows. Link presence comes from the filesystem cross-checked against the
 * link ledger.
 */
export declare function listSkills(cwd?: string): SkillSummary[];
/**
 * Read one skill document (body included). Strict frontmatter first; a
 * DESCRIPTION.md-style document falls back to the lenient parse (name from
 * its directory, description from its body).
 */
export declare function readSkill(path: string): SkillDetail | null;
/**
 * Resolve a slug to a runtime `SkillRegistration` for the context engine:
 * looks in the store first, then the external registry, and reads the
 * admission document (SKILL.md or DESCRIPTION.md) body verbatim (no
 * frontmatter rewriting, ever).
 * @returns undefined when the slug is unknown or its copy is gone.
 */
export declare function resolveRegistration(slug: string): SkillRegistration | undefined;
/**
 * Scan an arbitrary directory for importable skills: the root plus two
 * levels of sub-directories, skipping anything bigger than the cap. Every hit
 * is a *registration* candidate — the canonical copy stays in place.
 */
export declare function scanSkills(dir: string, maxBytes: number, depth: number): ScannedSkill[];
//# sourceMappingURL=scanner.d.ts.map