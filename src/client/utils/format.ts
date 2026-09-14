/**
 * Pure formatting helpers for the manager UI. No React, no framework imports —
 * everything here is a plain function so it can be unit-tested in isolation.
 */

/** Human label for a skill source id (the host reports stable ids, not paths). */
export function sourceLabel(source: string): string {
  if (source === 'project-dsh') return '.dsh/skills'
  if (source === 'project-agents') return '.agents/skills'
  if (source === 'user-dsh') return '~/.dsh/skills'
  if (source === 'user-agents') return '~/.agents/skills'
  return source
}

/** Parse `KEY=VALUE` lines into an object (blank/malformed lines are dropped). */
export function parseKv(text: string): Record<string, string> {
  const obj: Record<string, string> = {}
  if (!text) return obj
  for (const line of text.split(/\n/)) {
    const t = line.trim()
    if (!t) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    obj[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return obj
}

/** Render an object as `KEY=VALUE` lines (inverse of {@link parseKv}). */
export function kvText(obj: Record<string, string> | undefined): string {
  return Object.keys(obj || {}).map((k) => k + '=' + (obj || {})[k]).join('\n')
}

/**
 * Fill `{name}` placeholders in a translated string.
 *
 * Copy carries placeholders (never positional concatenation) so each language
 * keeps its own word order — `{n} 条已归档` versus `{n} of them are archived`.
 * An unknown key is left verbatim rather than blanked, so a missing value is
 * visible instead of silently swallowing a word.
 */
export function format(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (whole, key: string) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole
  ))
}

/** Normalise an unknown thrown value into a display string. */
export function errorText(e: unknown): string {
  return String((e as Error)?.message || e)
}

/** Strip a lower-cased query down for case-insensitive matching. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}
