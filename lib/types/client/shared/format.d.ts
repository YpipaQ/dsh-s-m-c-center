/**
 * Pure formatting helpers for the manager UI. No React, no framework imports —
 * everything here is a plain function so it can be unit-tested in isolation.
 */
/**
 * A description collapsed onto one line and capped, for a row's secondary line.
 *
 * `description: |` keeps its newlines, and a row that has to stay one line tall
 * cannot take them. CSS does the visual ellipsis; the cap keeps the DOM from
 * carrying a novel around.
 */
export declare function shortText(text: string, max?: number): string;
/** Parse `KEY=VALUE` lines into an object (blank/malformed lines are dropped). */
export declare function parseKv(text: string): Record<string, string>;
/** Render an object as `KEY=VALUE` lines (inverse of {@link parseKv}). */
export declare function kvText(obj: Record<string, string> | undefined): string;
/**
 * Fill `{name}` placeholders in a translated string.
 *
 * Copy carries placeholders (never positional concatenation) so each language
 * keeps its own word order — `{n} 条已归档` versus `{n} of them are archived`.
 * An unknown key is left verbatim rather than blanked, so a missing value is
 * visible instead of silently swallowing a word.
 */
export declare function format(tpl: string, vars: Record<string, string | number>): string;
/** Normalise an unknown thrown value into a display string. */
export declare function errorText(e: unknown): string;
/** Strip a lower-cased query down for case-insensitive matching. */
export declare function normalizeQuery(query: string): string;
//# sourceMappingURL=format.d.ts.map