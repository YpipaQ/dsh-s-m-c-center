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
import { basename, dirname, join } from 'node:path'

/** Whether the model may call a skill, and the user may invoke it by name. */
export interface SkillInvocation {
  modelInvocable: boolean
  userInvocable: boolean
}

/** A skill document that parsed into the fields the UI and agent need. */
export interface ParsedSkill {
  name: string
  description: string
  whenToUse: string
  /** Markdown body with the frontmatter block stripped. */
  content: string
  /** The author's call policy; both default to allowed when unstated. */
  invocation: SkillInvocation
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
 * A YAML block scalar header: the indicator plus its chomping modifier.
 * `>` folds (newlines become spaces), `|` keeps them; `-` strips the trailing
 * newline and `+` keeps every one of them.
 */
interface BlockStyle {
  kind: 'fold' | 'literal'
  chomp: 'strip' | 'clip' | 'keep'
}

/** Recognise a block scalar header, or undefined for an ordinary scalar. */
function blockStyle(value: string): BlockStyle | undefined {
  const match = /^([>|])([+-]?)$/.exec(value)
  if (match === null) return undefined
  return {
    kind: match[1] === '>' ? 'fold' : 'literal',
    chomp: match[2] === '-' ? 'strip' : match[2] === '+' ? 'keep' : 'clip',
  }
}

/**
 * Read a block scalar's body: the following lines that are indented deeper
 * than their key, stopping at the first line that is not.
 *
 * Without this the value is whatever sits between the colon and the end of the
 * line — which for `description: >` is the single character `>`. That is not a
 * parsing nit: the description is the one line the model sees in the skill
 * catalog, and the plugin's own registration *overrides* dsh's, so a wrong
 * value here is what the agent ends up reading.
 * @returns the value and the index of the first line after the block.
 */
function readBlock(lines: string[], from: number, until: number, style: BlockStyle): [string, number] {
  const body: string[] = []
  let index = from
  for (; index < until; index++) {
    const line = lines[index]
    if (line.trim() === '') {
      // A blank line inside a block keeps the paragraph break; two in a row end
      // it, and so does a dedented line.
      if (body.length > 0 && lines[index + 1] !== undefined && /^\s/.test(lines[index + 1])) body.push('')
      else break
      continue
    }
    if (!/^\s/.test(line)) break
    body.push(line)
  }
  if (body.length === 0) return ['', from]
  // Strip the block's own indentation: the shallowest content line defines it.
  const base = Math.min(...body.filter((l) => l.trim() !== '').map((l) => l.length - l.trimStart().length))
  const dedented = body.map((l) => (l.trim() === '' ? '' : l.slice(base)))
  // Literal keeps every line break; folding turns them into spaces, except at
  // a blank line, which is a paragraph break and stays one.
  let value = ''
  if (style.kind === 'literal') value = dedented.join('\n')
  else {
    for (let i = 0; i < dedented.length; i++) {
      if (i === 0) { value = dedented[i]; continue }
      const gap = dedented[i - 1] === '' || dedented[i] === '' ? '\n' : ' '
      value += gap + dedented[i]
    }
  }
  return [style.chomp === 'keep' ? value : value.trim(), index]
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
  let index = 1
  while (index < closing) {
    const line = lines[index]
    const separator = line.indexOf(':')
    if (separator < 0) { index += 1; continue } // not a key: value line
    const key = line.slice(0, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    const block = blockStyle(rawValue)
    if (block === undefined) {
      data[key] = scalarValue(unquote(rawValue))
      index += 1
      continue
    }
    const [value, next] = readBlock(lines, index + 1, closing, block)
    data[key] = value
    index = next <= index ? index + 1 : next
  }
  return { data, body: lines.slice(closing + 1).join('\n') }
}

/** A frontmatter field read as text; anything non-string reads as ''. */
export function textField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

/**
 * A frontmatter field read as a boolean.
 * @returns undefined when the key is absent or not a boolean, so "unset" and
 *   "false" stay different — the two invocation keys have opposite defaults.
 */
export function booleanField(data: Record<string, unknown>, key: string): boolean | undefined {
  const value = data[key]
  return typeof value === 'boolean' ? value : undefined
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
    invocation: invocationOf(front.data),
  }
}

/**
 * The author's invocation policy, mapped the way dsh's own filesystem provider
 * does it (`skill-filesystem/src/index.ts:1007-1008`).
 *
 * Both keys default to *allowed*, so an absent key must not read as a denial —
 * only an explicit `true` on `disable-model-invocation` and an explicit `false`
 * on `user-invocable` are the author taking something away.
 */
function invocationOf(data: Record<string, unknown>): SkillInvocation {
  return {
    modelInvocable: booleanField(data, 'disable-model-invocation') !== true,
    userInvocable: booleanField(data, 'user-invocable') !== false,
  }
}

/**
 * Markdown openers that end a paragraph: a summary must not swallow the list
 * or heading that follows the opening line.
 */
const BLOCK_START = /^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||`{3,})/

/** Consecutive lines from `start`, stopping at a blank line or a new block. */
function paragraph(lines: string[], start: number): string[] {
  const out: string[] = []
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') break
    if (i > start && BLOCK_START.test(line)) break
    out.push(line)
  }
  return out
}

/**
 * The opening of a markdown body, for a description cell.
 *
 * Prose in markdown is soft-wrapped, so the first *line* is not a unit of
 * meaning — taking it alone cut sentences in half ("…the Mac desktop (Finder,").
 * Join the whole first paragraph instead, but stop where the author changed
 * block: a heading or a list item is a complete thought on its own.
 */
export function bodySummary(body: string): string {
  const lines = body.split(/\r?\n/)
  const first = lines.findIndex((l) => l.trim() !== '')
  if (first < 0) return ''
  const head = lines[first].trim()
  const opened = BLOCK_START.test(head) ? [head] : paragraph(lines, first)
  const trimmed = opened.join(' ').replace(/^#+\s*/, '').trim()
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
    invocation: front === null
      ? { modelInvocable: true, userInvocable: true }
      : invocationOf(front.data),
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

/**
 * The bundle directory a path refers to, given that the path may be the
 * bundle's admission document instead.
 *
 * A row in the panel carries the *document* path (`…/apple/DESCRIPTION.md`)
 * because that is what a skill is identified by; every bundle operation wants
 * the directory. Deriving it here — for either document, and on the receiving
 * side of the wire — is what keeps "SKILL.md or DESCRIPTION.md" true for the
 * callers too: an earlier version stripped only `SKILL.md`, so migrating a
 * `DESCRIPTION.md`-only bundle sent a file path where a directory was expected
 * and failed every time.
 */
export function bundleDirOf(path: string): string {
  return (ADMISSION_DOCS as readonly string[]).includes(basename(path)) ? dirname(path) : path
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
