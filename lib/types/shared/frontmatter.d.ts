/**
 * Skill-document parsing: frontmatter, admission rules, slugs.
 *
 * Everything here is pure text work — no filesystem walking, no ledgers. The
 * skills feature composes these into its scanning and adoption flows; keeping
 * them apart means the admission rule (SKILL.md strict, DESCRIPTION.md lenient)
 * can be read and tested on its own.
 *
 * The rule itself: a directory is admitted as a skill when it holds **either**
 * `SKILL.md` or `DESCRIPTION.md`. `SKILL.md` keeps the strict dsh requirement
 * (frontmatter with both `name` and `description`); a `DESCRIPTION.md`-only
 * skill takes its name from the directory and its description from the first
 * line of the body. Nothing here ever rewrites a skill document.
 * @module
 */
/** A skill document that parsed into the fields the UI and agent need. */
export interface ParsedSkill {
    name: string;
    description: string;
    whenToUse: string;
    /** Markdown body with the frontmatter block stripped. */
    content: string;
}
/** A parsed bundle plus the document that admitted it. */
export interface ParsedBundle {
    parsed: ParsedSkill;
    /** Absolute path of the admitting document (SKILL.md or DESCRIPTION.md). */
    doc: string;
}
/** The two documents that admit a directory as a skill, in priority order. */
export declare const ADMISSION_DOCS: readonly ["SKILL.md", "DESCRIPTION.md"];
interface Frontmatter {
    data: Record<string, unknown>;
    body: string;
}
/** Read one frontmatter scalar: a literal, an integer, or the raw string. */
export declare function scalarValue(raw: string): unknown;
/** Drop one layer of matching quotes from a scalar. */
export declare function unquote(value: string): string;
/**
 * Read the leading `---` block of a skill document.
 * @returns the parsed keys plus the remaining body, or null when the document
 *   has no block (a plain markdown file is not a skill).
 */
export declare function parseFrontmatter(raw: string): Frontmatter | null;
/** A frontmatter field read as text; anything non-string reads as ''. */
export declare function textField(data: Record<string, unknown>, key: string): string;
/**
 * Parse one skill document (strict: the SKILL.md rule).
 * @returns null when it has no frontmatter, or is missing its name/description
 *   (dsh requires both, so such a file is not a skill).
 */
export declare function parseSkillFile(raw: string): ParsedSkill | null;
/**
 * The opening of a markdown body, for a description cell.
 *
 * Prose in markdown is soft-wrapped, so the first *line* is not a unit of
 * meaning — taking it alone cut sentences in half ("…the Mac desktop (Finder,").
 * Join the whole first paragraph instead, but stop where the author changed
 * block: a heading or a list item is a complete thought on its own.
 */
export declare function bodySummary(body: string): string;
/**
 * Lenient parse for DESCRIPTION.md-style documents: frontmatter keys win when
 * present, the directory (or file) name stands in for a missing name, and a
 * missing description falls back to the first line of the body. Never returns
 * null — the existence of the document is the admission rule.
 */
export declare function parseDescriptionFile(raw: string, fallbackName: string): ParsedSkill;
/**
 * The first admission document present in `dir`, or undefined.
 * SKILL.md wins when both exist; DESCRIPTION.md alone is enough.
 */
export declare function admissionDoc(dir: string): string | undefined;
/** Strict parse of one flat skill document; null when it is not a skill. */
export declare function parseFlatDoc(path: string): ParsedSkill | null;
/**
 * Parse the bundle at `dir`: SKILL.md first (strict frontmatter), falling
 * back to DESCRIPTION.md (lenient) when SKILL.md is missing or unparsable.
 * @returns the parsed skill plus the document that admitted it, or undefined
 *   when the directory holds neither document in a usable form.
 */
export declare function parseBundleDocs(dir: string): ParsedBundle | undefined;
/** Filesystem-safe store directory name for a skill. */
export declare function slugify(input: string): string;
/** A slug that does not collide with `taken` (appends -2, -3 …). */
export declare function uniqueSlug(taken: Set<string>, base: string): string;
export {};
//# sourceMappingURL=frontmatter.d.ts.map