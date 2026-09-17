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

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/** A skill document that parsed into the fields the UI and agent need. */
export interface ParsedSkill {
  name: string
  description: string
  whenToUse: string
  /** Markdown body with the frontmatter block stripped. */
  content: string
}

/** A parsed bundle plus the document that admitted it. */
export interface ParsedBundle {
  parsed: ParsedSkill
  /** Absolute path of the admitting document (SKILL.md or DESCRIPTION.md). */
  doc: string
}

/** The exact spellings a YAML scalar may use for each literal. */
const TRUE_LITERALS = new Set(['true', 'True', 'TRUE'])
const FALSE_LITERALS = new Set(['false', 'False', 'FALSE'])
const NULL_LITERALS = new Set(['null', '~'])

/** Separator line that opens and closes a frontmatter block. */
const FENCE = '---'

/** The two documents that admit a directory as a skill, in priority order. */
export const ADMISSION_DOCS = ['SKILL.md', 'DESCRIPTION.md'] as const

interface Frontmatter { data: Record<string, unknown>; body: string }

/** Read one frontmatter scalar: a literal, an integer, or the raw string. */
export function scalarValue(raw: string): unknown {
  if (TRUE_LITERALS.has(raw)) return true
  if (FALSE_LITERALS.has(raw)) return false
  if (NULL_LITERALS.has(raw)) return null
  return /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : raw
}

/** Drop one layer of matching quotes from a scalar. */
export function unquote(value: string): string {
  const first = value[0]
  if (value.length < 2 || first !== value[value.length - 1]) return value
  return first === '"' || first === "'" ? value.slice(1, -1) : value
}

/**
 * Read the leading `---` block of a skill document.
 * @returns the parsed keys plus the remaining body, or null when the document
 *   has no block (a plain markdown file is not a skill).
 */
export function parseFrontmatter(raw: string): Frontmatter | null {
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== FENCE) return null
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE)
  if (closing < 0) return null
  const data: Record<string, unknown> = {}
  for (const line of lines.slice(1, closing)) {
    const separator = line.indexOf(':')
    if (separator < 0) continue // not a key: value line
    const key = line.slice(0, separator).trim()
    data[key] = scalarValue(unquote(line.slice(separator + 1).trim()))
  }
  return { data, body: lines.slice(closing + 1).join('\n') }
}

/** A frontmatter field read as text; anything non-string reads as ''. */
export function textField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Parse one skill document (strict: the SKILL.md rule).
 * @returns null when it has no frontmatter, or is missing its name/description
 *   (dsh requires both, so such a file is not a skill).
 */
export function parseSkillFile(raw: string): ParsedSkill | null {
  const front = parseFrontmatter(raw)
  if (front === null) return null
  const name = textField(front.data, 'name')
  const description = textField(front.data, 'description')
  if (name === '' || description === '') return null
  return {
    name,
    description,
    whenToUse: textField(front.data, 'whenToUse'),
    content: front.body.trim(),
  }
}

/** First non-empty line of a markdown body, truncated for a description cell. */
export function bodySummary(body: string): string {
  const line = body.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const trimmed = line.replace(/^#+\s*/, '').trim()
  return trimmed.length > 160 ? trimmed.slice(0, 157) + '…' : trimmed
}

/**
 * Lenient parse for DESCRIPTION.md-style documents: frontmatter keys win when
 * present, the directory (or file) name stands in for a missing name, and a
 * missing description falls back to the first line of the body. Never returns
 * null — the existence of the document is the admission rule.
 */
export function parseDescriptionFile(raw: string, fallbackName: string): ParsedSkill {
  const front = parseFrontmatter(raw)
  const body = front === null ? raw.trim() : front.body.trim()
  return {
    name: (front === null ? '' : textField(front.data, 'name')) || fallbackName,
    description: (front === null ? '' : textField(front.data, 'description')) || bodySummary(body),
    whenToUse: front === null ? '' : textField(front.data, 'whenToUse'),
    content: body,
  }
}

/**
 * The first admission document present in `dir`, or undefined.
 * SKILL.md wins when both exist; DESCRIPTION.md alone is enough.
 */
export function admissionDoc(dir: string): string | undefined {
  for (const doc of ADMISSION_DOCS) {
    const p = join(dir, doc)
    if (existsSync(p)) return p
  }
  return undefined
}

/** Strict parse of one flat skill document; null when it is not a skill. */
export function parseFlatDoc(path: string): ParsedSkill | null {
  try { return parseSkillFile(readFileSync(path, 'utf8')) } catch { return null }
}

/**
 * Parse the bundle at `dir`: SKILL.md first (strict frontmatter), falling
 * back to DESCRIPTION.md (lenient) when SKILL.md is missing or unparsable.
 * @returns the parsed skill plus the document that admitted it, or undefined
 *   when the directory holds neither document in a usable form.
 */
export function parseBundleDocs(dir: string): ParsedBundle | undefined {
  const skillPath = join(dir, 'SKILL.md')
  if (existsSync(skillPath)) {
    try {
      const parsed = parseSkillFile(readFileSync(skillPath, 'utf8'))
      if (parsed !== null) return { parsed, doc: skillPath }
    } catch { /* fall through to DESCRIPTION.md */ }
  }
  const descPath = join(dir, 'DESCRIPTION.md')
  if (!existsSync(descPath)) return undefined
  try {
    return { parsed: parseDescriptionFile(readFileSync(descPath, 'utf8'), basename(dir)), doc: descPath }
  } catch { return undefined }
}

/** Filesystem-safe store directory name for a skill. */
export function slugify(input: string): string {
  const s = input.trim().toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[.-]+$/g, '')
    .replace(/^-+/, '')
  return s === '' ? 'skill' : s
}

/** A slug that does not collide with `taken` (appends -2, -3 …). */
export function uniqueSlug(taken: Set<string>, base: string): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = base + '-' + String(i)
    if (!taken.has(candidate)) return candidate
  }
}
