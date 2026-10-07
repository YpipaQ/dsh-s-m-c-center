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
/**
 * Read one skill document (body included). Strict frontmatter first; a
 * DESCRIPTION.md-style document falls back to the lenient parse (name from
 * its directory, description from its body).
 *
 * A *directory* is the one input that has no document to read — the shape a
 * flagged non-skill row takes. Rather than letting `readFileSync` throw (the
 * request would 500 and the panel would show a raw error for a row the user is
 * clicking precisely to understand), it answers with the same explanation the
 * row's own description carries.
 */
export declare function readSkill(path: string): SkillDetail | null;
/**
 * Resolve a slug to a runtime `SkillRegistration` for the context engine:
 * looks in the store first, then the external registry, and reads the
 * admission document (SKILL.md or DESCRIPTION.md) body verbatim (no
 * frontmatter rewriting, ever).
 *
 * A row that carries **no** admission document is refused here even though
 * {@link resolveCandidate} can describe it. That description exists so the panel
 * can answer "why is this row red?" when a user clicks it, and a description is
 * not a body: this function is the *loading* path (the context engine and
 * `skill_select` both call it), and handing back the explanation there installed
 * a non-skill into a conversation — the panel said "not loadable" while the
 * model's catalog listed it as loadable, and the slug was written into the
 * conversation's selection file where no cleanup would ever remove it. The two
 * questions are different questions and now get different answers.
 *
 * @returns undefined when the slug is unknown, its copy is gone, or it is a
 * directory with nothing to load.
 */
export declare function resolveRegistration(slug: string): SkillRegistration | undefined;
/**
 * Why the model may not enable `slug`, or undefined when it may.
 *
 * A directory admitted by `DESCRIPTION.md` alone is a *container*: it lists in
 * the panel and migrates into the store, but it has no body to load. Letting a
 * flip accept it produced a dead line in the model's catalog.
 *
 * A directory with *no* admission document at all is worse — there is not even
 * a body to show. It is not a skill at all, and dsh would not see anything in
 * it either, so it is refused with the reason said plainly rather than a flip
 * that appears to do nothing.
 */
export declare function enableBlocker(slug: string): string | undefined;
/**
 * Scan an arbitrary directory for importable skills: the root plus two
 * levels of sub-directories, skipping anything bigger than the cap. Every hit
 * is a *registration* candidate — the canonical copy stays in place.
 */
export declare function scanSkills(dir: string, maxBytes: number, depth: number): ScannedSkill[];
//# sourceMappingURL=scanner.d.ts.map