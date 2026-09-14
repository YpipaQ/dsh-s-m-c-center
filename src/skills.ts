/**
 * Skills filesystem engine — scans the four manageable skill roots, parses
 * SKILL.md frontmatter, and performs enable/disable, delete, scan-for-import,
 * and import. Runs in the Host process with direct node:fs access (a real npm
 * package no longer needs the shell+node hack the dynamic plugin used).
 *
 * Skills adopted into the store live in `~/.dsh/S-M-C/skills/<slug>/` as the
 * single canonical copy; enabling one writes a directory link back into its
 * source root (`~/.dsh/skills/<slug>`), disabling removes that link. dsh's own
 * scanner follows links (`skill-filesystem` `nodeEntryKind` stats a symlink
 * entry), so a linked skill is fully visible to the agent while an unlinked one
 * is invisible — and the SKILL.md itself is never rewritten.
 * @module
 */

import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync,
  readlinkSync, renameSync, rmdirSync, rmSync, statSync, symlinkSync,
  unlinkSync, writeFileSync,
} from 'node:fs'
import type { Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import type {
  ImportItem, ImportResult, ScannedSkill, SkillDetail, SkillLevel,
  SkillSource, SkillSummary, StoreEntry, StoreFailure, StoreIndex,
  StoreOperation, StoreStatus,
} from './protocol.ts'
import { dshHomeDir, movePath, storeRoot, storeSkillsDir } from './store.ts'

/** User-level skill roots (project roots are derived from the workspace cwd). */
export interface SkillRoots {
  home: string
  dshHome: string
  agentsHome: string
  userSkillsDir: string
  agentsSkillsDir: string
  /** Canonical store holding one copy of every adopted skill. */
  storeDir: string
}

/**
 * Directory name of the legacy store, kept only so {@link migrateStoreRoot}
 * can recognise an old layout and move it. New code uses `storeSkillsDir()`
 * from ./store.ts — the skills live under the unified S-M-C root now.
 */
export const STORE_DIR_NAME = 'skills-store'

function agentsHomeDir(): string {
  return process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')
}

/** True when `child` is `parent` or lives beneath it (case-insensitive on Windows). */
function inside(parent: string, child: string): boolean {
  const p = resolve(parent)
  const c = resolve(child)
  if (process.platform === 'win32') {
    const lower = c.toLowerCase()
    const base = p.toLowerCase()
    return lower === base || lower.startsWith(base.endsWith(sep) ? base : base + sep)
  }
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep)
}

/** True when `path` is a symlink or a Windows junction. */
function isLink(path: string): boolean {
  try { readlinkSync(path); return true } catch { return false }
}

/** Link target, or undefined when `path` is a real file/directory. */
function linkTarget(path: string): string | undefined {
  try { return readlinkSync(path) } catch { return undefined }
}

/**
 * Resolve a directory entry to a usable kind, following links.
 *
 * A junction reports `isSymbolicLink()` and neither `isDirectory()` nor
 * `isFile()`, so a naive scan silently skips every linked skill. This mirrors
 * dsh's own `nodeEntryKind` so the UI and the agent agree on what exists.
 */
function entryKind(fullPath: string, entry: Dirent): 'directory' | 'file' | undefined {
  if (entry.isDirectory()) return 'directory'
  if (entry.isFile()) return 'file'
  if (!entry.isSymbolicLink()) return undefined
  try {
    const info = statSync(fullPath)
    if (info.isDirectory()) return 'directory'
    if (info.isFile()) return 'file'
  } catch {
    return undefined
  }
  return undefined
}

/** Resolve (and materialize) the user-level skill roots plus the store. */
export function getRoots(): SkillRoots {
  const home = homedir()
  const dshHome = dshHomeDir()
  const agentsHome = agentsHomeDir()
  const userSkillsDir = join(dshHome, 'skills')
  mkdirSync(userSkillsDir, { recursive: true })
  return {
    home, dshHome, agentsHome, userSkillsDir,
    storeDir: storeSkillsDir(),
    agentsSkillsDir: join(agentsHome, 'skills'),
  }
}

/** How many parent directories {@link findProjectRoot} will climb. */
const MAX_ROOT_HOPS = 100

/** Marker whose presence means "this directory is a project root". */
const PROJECT_MARKER = '.git'

/** Walk up from cwd to the nearest .git directory (the project root). */
export function findProjectRoot(cwd?: string): string {
  let current = resolve(cwd ?? process.cwd())
  let hops = 0
  while (hops++ < MAX_ROOT_HOPS) {
    if (existsSync(join(current, PROJECT_MARKER))) return current
    const parent = dirname(current)
    if (parent === current) break // reached the volume root
    current = parent
  }
  return current
}

/** Project-level sources are the ones that belong to a workspace. */
function levelOf(source: SkillSource): SkillLevel {
  return source.startsWith('project') ? 'project' : 'user'
}

/** The exact spellings a YAML scalar may use for each literal. */
const TRUE_LITERALS = new Set(['true', 'True', 'TRUE'])
const FALSE_LITERALS = new Set(['false', 'False', 'FALSE'])
const NULL_LITERALS = new Set(['null', '~'])

/** Read one frontmatter scalar: a literal, an integer, or the raw string. */
function scalarValue(raw: string): unknown {
  if (TRUE_LITERALS.has(raw)) return true
  if (FALSE_LITERALS.has(raw)) return false
  if (NULL_LITERALS.has(raw)) return null
  return /^-?\d+$/.test(raw) ? Number.parseInt(raw, 10) : raw
}

/** Boolean reading of a frontmatter value; undefined when it is not one. */
function parseBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value !== 'string') return undefined
  switch (value.toLowerCase()) {
    case 'true':
    case 'yes':
    case 'on':
      return true
    case 'false':
    case 'no':
    case 'off':
      return false
    default:
      return undefined
  }
}

/** Separator line that opens and closes a frontmatter block. */
const FENCE = '---'

interface Frontmatter { data: Record<string, unknown>; body: string }

/** Drop one layer of matching quotes from a scalar. */
function unquote(value: string): string {
  const first = value[0]
  if (value.length < 2 || first !== value[value.length - 1]) return value
  return first === '"' || first === "'" ? value.slice(1, -1) : value
}

/**
 * Read the leading `---` block of a skill document.
 * @returns the parsed keys plus the remaining body, or null when the document
 *   has no block (a plain markdown file is not a skill).
 */
function parseFrontmatter(raw: string): Frontmatter | null {
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

interface ParsedSkill { name: string; description: string; whenToUse: string; enabled: boolean; content: string }

/** A frontmatter field read as text; anything non-string reads as ''. */
function textField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Parse one skill document.
 * @returns null when it has no frontmatter, or is missing its name/description
 *   (dsh requires both, so such a file is not a skill).
 */
function parseSkillFile(raw: string): ParsedSkill | null {
  const front = parseFrontmatter(raw)
  if (front === null) return null
  const name = textField(front.data, 'name')
  const description = textField(front.data, 'description')
  if (name === '' || description === '') return null
  const disableModel = parseBool(front.data['disable-model-invocation'])
  const userInvocable = parseBool(front.data['user-invocable'])
  return {
    name,
    description,
    whenToUse: textField(front.data, 'whenToUse'),
    // Hidden only when both switches say so: a skill stays visible if the
    // model may still invoke it, or if the user still can.
    enabled: (disableModel !== true) || (userInvocable !== false),
    content: front.body.trim(),
  }
}

/** Frontmatter keys that decide whether a skill is visible to the agent. */
const INVOCATION_KEYS = [
  'disable-model-invocation',
  'disableModelInvocation',
  'modelInvocable',
  'user-invocable',
  'userInvocable',
]

/** Matches a frontmatter line that sets one of the invocation keys. */
const INVOCATION_LINE = new RegExp(`^\\s*(${INVOCATION_KEYS.join('|')})\\s*:`)

/**
 * Rewrite the frontmatter so the skill reads as enabled or disabled.
 *
 * Only ever used for project-level skills: a managed skill is switched off by
 * removing its link, which leaves the file untouched. The old spellings are
 * stripped along with the current ones, because dsh drops a whole skill when
 * it meets a retired spelling.
 */
function toggleInvocation(raw: string, enabled: boolean): string {
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== FENCE) return raw
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE)
  if (closing < 0) return raw
  const kept = lines.slice(1, closing).filter((line) => !INVOCATION_LINE.test(line))
  if (!enabled) kept.push('disable-model-invocation: true', 'user-invocable: false')
  return [lines[0], ...kept, ...lines.slice(closing)].join('\n')
}

/** Filesystem-safe store directory name for a skill. */
function slugify(input: string): string {
  const s = input.trim().toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[.-]+$/g, '')
    .replace(/^-+/, '')
  return s === '' ? 'skill' : s
}

/** A slug that does not collide with `taken` (appends -2, -3 …). */
function uniqueSlug(taken: Set<string>, base: string): string {
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = base + '-' + String(i)
    if (!taken.has(candidate)) return candidate
  }
}

/** Root directory a link is written back to for one source. */
function rootFor(source: SkillSource, roots: SkillRoots): string {
  return source === 'user-agents' ? roots.agentsSkillsDir : roots.userSkillsDir
}

/** Link kind: junctions need no elevation on Windows, symlinks elsewhere. */
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir'

export class SkillsManager {
  /** The skills directory (created on demand inside the unified store root). */
  storeDir(): string {
    return storeSkillsDir()
  }

  // ── store manifest ──────────────────────────────────────────────────────

  /**
   * Read the store manifest, rebuilding it from disk when missing or corrupt.
   * A corrupt file is kept as `index.corrupt.json` rather than deleted.
   */
  readStoreIndex(): StoreIndex {
    const dir = this.storeDir()
    const file = join(dir, 'index.json')
    if (!existsSync(file)) return this.recoverIndex()
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as StoreIndex).entries)) {
        throw new Error('malformed store index')
      }
      return parsed as StoreIndex
    } catch {
      try { copyFileSync(file, join(dir, 'index.corrupt.json')) } catch { /* best effort */ }
      const recovered = this.recoverIndex()
      this.writeStoreIndex(recovered)
      return recovered
    }
  }

  /** Write the manifest atomically (temp file + rename). */
  writeStoreIndex(index: StoreIndex): void {
    const dir = this.storeDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'index.json')
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8')
    renameSync(tmp, file)
  }

  /**
   * Rebuild the manifest from whatever bundles exist in the store directory.
   * Used when index.json is missing (first run after a manual copy, or a
   * corrupt file) so adopted skills are not silently orphaned.
   */
  recoverIndex(): StoreIndex {
    const dir = this.storeDir()
    const entries: StoreEntry[] = []
    if (!existsSync(dir)) return { version: 1, entries }
    let names: string[] = []
    try { names = readdirSync(dir) } catch { return { version: 1, entries } }
    for (const slug of names) {
      if (slug.startsWith('.')) continue
      const mdPath = join(dir, slug, 'SKILL.md')
      if (!existsSync(mdPath)) continue
      let parsed: ParsedSkill | null = null
      try { parsed = parseSkillFile(readFileSync(mdPath, 'utf8')) } catch { continue }
      if (parsed === null) continue
      entries.push({
        slug,
        name: parsed.name,
        origin: '',
        source: this.linkedSource(slug) ?? 'user-dsh',
        enabled: this.linkedSource(slug) !== undefined,
        adoptedAt: new Date().toISOString(),
      })
    }
    return { version: 1, entries }
  }

  /** Which root currently holds a link for `slug`, if any. */
  private linkedSource(slug: string): SkillSource | undefined {
    const roots = getRoots()
    const store = this.storeDir()
    for (const source of ['user-dsh', 'user-agents'] as const) {
      const link = join(rootFor(source, roots), slug)
      const target = linkTarget(link)
      if (target !== undefined && inside(store, resolve(link, '..', target))) return source
    }
    return undefined
  }

  /** Replace (or insert) one manifest entry. */
  private upsertEntry(entry: StoreEntry): void {
    const index = this.readStoreIndex()
    const idx = index.entries.findIndex((e) => e.slug === entry.slug)
    if (idx >= 0) index.entries[idx] = entry
    else index.entries.push(entry)
    this.writeStoreIndex(index)
  }

  /** Drop one manifest entry. */
  private dropEntry(slug: string): void {
    const index = this.readStoreIndex()
    index.entries = index.entries.filter((e) => e.slug !== slug)
    this.writeStoreIndex(index)
  }

  // ── linking ─────────────────────────────────────────────────────────────

  /**
   * Materialise the link for one stored skill. No-op when it already exists;
   * refuses to overwrite a real directory.
   */
  private linkInto(slug: string, source: SkillSource): void {
    const roots = getRoots()
    const root = rootFor(source, roots)
    mkdirSync(root, { recursive: true })
    const link = join(root, slug)
    const target = join(this.storeDir(), slug)
    if (isLink(link)) return
    if (existsSync(link)) throw new Error('已存在同名条目：' + link)
    symlinkSync(target, link, LINK_TYPE)
  }

  /**
   * Remove the link for one stored skill. Only ever removes a link — a real
   * directory is left alone so a stray path can never delete the store copy.
   */
  private unlinkFrom(slug: string, source: SkillSource): void {
    const link = join(rootFor(source, getRoots()), slug)
    if (!isLink(link)) return
    if (process.platform === 'win32') rmdirSync(link)
    else unlinkSync(link)
  }

  /**
   * Repoint every link that targets `from` at `to`.
   *
   * A junction stores an absolute target string, so moving the store silently
   * breaks every link into it: the bundles are intact, but `~/.dsh/skills/x`
   * still names the old path and the agent stops seeing the skill entirely.
   * This is the repair step the store-root migration runs right after moving.
   * @param from - the old store directory (may no longer exist).
   * @param to - the new store directory.
   * @returns how many links were rebuilt.
   */
  relinkSkills(from: string, to: string): number {
    const roots = getRoots()
    const base = resolve(from)
    let count = 0
    for (const dir of [roots.userSkillsDir, roots.agentsSkillsDir]) {
      if (!existsSync(dir)) continue
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (!isLink(full)) continue
        const target = linkTarget(full)
        if (target === undefined || !inside(base, target)) continue
        // Drop the stale link first: creating over an existing one fails.
        try {
          if (process.platform === 'win32') rmdirSync(full)
          else unlinkSync(full)
        } catch { continue }
        try {
          symlinkSync(join(to, basename(target)), full, LINK_TYPE)
          count++
        } catch { /* the caller reports the state through a rescan */ }
      }
    }
    return count
  }

  // ── adoption ────────────────────────────────────────────────────────────

  /**
   * Move one skill into the store as a bundle and (when enabled) link it back.
   *
   * The stored copy is normalised: any `disable-model-invocation` /
   * `user-invocable` flags are stripped, because from here on visibility is
   * decided by link presence alone — leaving the flags in place would keep a
   * re-enabled skill hidden from the model.
   */
  private adopt(
    sourcePath: string,
    kind: 'bundle' | 'file',
    source: SkillSource,
    enabled: boolean,
    releaseDir?: string,
  ): string {
    const store = this.storeDir()
    mkdirSync(store, { recursive: true })
    const mdPath = kind === 'bundle' ? join(sourcePath, 'SKILL.md') : sourcePath
    const raw = readFileSync(mdPath, 'utf8')
    const parsed = parseSkillFile(raw)
    if (parsed === null) throw new Error('不是有效的技能文件：' + mdPath)
    const taken = new Set<string>(readdirSync(store).filter((n) => !n.startsWith('.')))
    const slug = uniqueSlug(taken, slugify(parsed.name || basename(sourcePath, extname(sourcePath))))
    const dest = join(store, slug)

    if (kind === 'bundle') {
      movePath(sourcePath, dest)
      writeFileSync(join(dest, 'SKILL.md'), toggleInvocation(raw, true), 'utf8')
    } else {
      mkdirSync(dest, { recursive: true })
      movePath(sourcePath, join(dest, 'SKILL.md'))
      writeFileSync(join(dest, 'SKILL.md'), toggleInvocation(raw, true), 'utf8')
    }

    if (enabled) this.linkInto(slug, source)
    this.upsertEntry({
      slug,
      name: parsed.name,
      // Migration adopts keep the pre-adoption path (rollback restores the
      // status quo ante). Imports come from arbitrary directories the user
      // happened to pick — releasing them back there would scatter skills
      // across the filesystem again, so their release target is pinned to
      // the dsh user skills root.
      origin: releaseDir !== undefined ? join(releaseDir, slug) : sourcePath,
      source,
      enabled,
      adoptedAt: new Date().toISOString(),
    })
    return slug
  }

  /**
   * Resolve a skill path back to its store identity, or undefined when the
   * skill is not managed (still in place, toggled by frontmatter).
   */
  private resolveManaged(path: string): { slug: string; source: SkillSource } | undefined {
    const store = this.storeDir()
    const dir = dirname(path)
    const target = linkTarget(dir)
    if (target !== undefined) {
      const resolvedTarget = resolve(dir, target)
      if (inside(store, resolvedTarget)) {
        const slug = basename(resolvedTarget)
        return { slug, source: this.linkedSource(slug) ?? this.entryOf(slug)?.source ?? 'user-dsh' }
      }
    }
    if (inside(store, path)) {
      const slug = basename(dir)
      return { slug, source: this.entryOf(slug)?.source ?? 'user-dsh' }
    }
    return undefined
  }

  /** Manifest entry for one slug, when present. */
  private entryOf(slug: string): StoreEntry | undefined {
    return this.readStoreIndex().entries.find((e) => e.slug === slug)
  }

  // ── scanning ────────────────────────────────────────────────────────────

  /** Scan one skill root directory into SkillSummary records. */
  scanRoot(dir: string, source: SkillSource): SkillSummary[] {
    const items: SkillSummary[] = []
    if (!existsSync(dir)) return items
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return items }
    const store = this.storeDir()
    for (const entry of entries) {
      const name = entry.name
      if (!name || name === '.system' || name[0] === '.') continue
      const full = join(dir, name)
      const kind = entryKind(full, entry)
      if (kind === 'directory') {
        const mdPath = join(full, 'SKILL.md')
        if (!existsSync(mdPath)) continue
        let raw: string
        try { raw = readFileSync(mdPath, 'utf8') } catch { continue }
        const parsed = parseSkillFile(raw)
        if (parsed === null) continue
        items.push({
          ...parsed, source, level: levelOf(source), kind: 'bundle', path: mdPath,
          ...managedFields(store, full),
        })
      } else if (kind === 'file' && name.endsWith('.md')) {
        let raw: string
        try { raw = readFileSync(full, 'utf8') } catch { continue }
        const parsed = parseSkillFile(raw)
        if (parsed === null) continue
        items.push({
          ...parsed, source, level: levelOf(source), kind: 'file', path: full,
          managed: false,
        })
      }
    }
    return items
  }

  /** The roots to walk for a listing, in display order: project, then user. */
  private scanTargets(cwd?: string): Array<{ path: string; source: SkillSource }> {
    const roots = getRoots()
    const userTargets: Array<{ path: string; source: SkillSource }> = [
      { path: roots.userSkillsDir, source: 'user-dsh' },
      { path: roots.agentsSkillsDir, source: 'user-agents' },
    ]
    if (!cwd) return userTargets
    const projectRoot = findProjectRoot(cwd)
    return [
      { path: join(projectRoot, '.dsh', 'skills'), source: 'project-dsh' },
      { path: join(projectRoot, '.agents', 'skills'), source: 'project-agents' },
      ...userTargets,
    ]
  }

  /**
   * List skills across project and/or user roots, de-duplicated by path, plus
   * every stored skill that is currently unlinked (so it can be re-enabled).
   */
  listSkills(cwd?: string): SkillSummary[] {
    const seen = new Set<string>()
    const items: SkillSummary[] = []
    for (const target of this.scanTargets(cwd)) {
      for (const found of this.scanRoot(target.path, target.source)) {
        if (seen.has(found.path)) continue
        seen.add(found.path)
        items.push(found)
      }
    }
    // Stored-but-unlinked skills are invisible to every root scan, yet the user
    // still needs a row to switch them back on.
    const store = this.storeDir()
    for (const entry of this.readStoreIndex().entries) {
      if (this.linkedSource(entry.slug) !== undefined) continue
      const mdPath = join(store, entry.slug, 'SKILL.md')
      if (seen.has(mdPath)) continue
      let parsed: ParsedSkill | null = null
      try { parsed = parseSkillFile(readFileSync(mdPath, 'utf8')) } catch { continue }
      if (parsed === null) continue
      seen.add(mdPath)
      items.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        enabled: false,
        source: entry.source,
        level: levelOf(entry.source),
        kind: 'bundle',
        path: mdPath,
        managed: true,
        slug: entry.slug,
      })
    }
    // Bundles dropped straight into the store — an agent following the
    // announcement's registration guidance — have no manifest entry yet, so
    // the loop above cannot see them. List them as disabled managed rows:
    // enabling goes through setSkillEnabled(), which upserts the manifest
    // entry, and that is the moment the skill is adopted for good.
    const knownSlugs = new Set(this.readStoreIndex().entries.map((e) => e.slug))
    let stored: string[] = []
    try { stored = readdirSync(store) } catch { /* store not created yet */ }
    for (const slug of stored) {
      if (slug.startsWith('.') || knownSlugs.has(slug)) continue
      const mdPath = join(store, slug, 'SKILL.md')
      if (seen.has(mdPath)) continue
      let parsed: ParsedSkill | null = null
      try { parsed = parseSkillFile(readFileSync(mdPath, 'utf8')) } catch { continue }
      if (parsed === null) continue
      seen.add(mdPath)
      items.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        enabled: false,
        source: 'user-dsh',
        level: 'user',
        kind: 'bundle',
        path: mdPath,
        managed: true,
        slug,
      })
    }
    // dsh-managed roots first (.dsh/skills before .agents/skills), then name.
    const srcRank = (s: SkillSource) => (s === 'user-dsh' || s === 'project-dsh' ? 0 : 1)
    items.sort((a, b) => {
      if (a.level !== b.level) return a.level === 'project' ? -1 : 1
      const d = srcRank(a.source) - srcRank(b.source)
      if (d !== 0) return d
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    return items
  }

  /** Read one skill document (body included). */
  readSkill(path: string): SkillDetail | null {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf8')
    const parsed = parseSkillFile(raw)
    if (parsed === null) return null
    return { ...parsed, path }
  }

  // ── mutation ────────────────────────────────────────────────────────────

  /**
   * Enable/disable a skill. Managed skills are linked/unlinked (their SKILL.md
   * is never touched); everything else still falls back to rewriting the
   * frontmatter invocation flags.
   */
  setSkillEnabled(path: string, enabled: boolean): void {
    const managed = this.resolveManaged(path)
    if (managed !== undefined) {
      const entry = this.entryOf(managed.slug)
      if (enabled) this.linkInto(managed.slug, managed.source)
      else this.unlinkFrom(managed.slug, managed.source)
      this.upsertEntry({
        slug: managed.slug,
        name: entry?.name ?? basename(managed.slug),
        origin: entry?.origin ?? '',
        source: managed.source,
        enabled,
        adoptedAt: entry?.adoptedAt ?? new Date().toISOString(),
      })
      return
    }
    const raw = readFileSync(path, 'utf8')
    writeFileSync(path, toggleInvocation(raw, enabled), 'utf8')
  }

  /** Delete a skill: for managed ones, drop the link and the store copy. */
  deleteSkill(path: string, kind: 'bundle' | 'file'): string {
    const managed = this.resolveManaged(path)
    if (managed !== undefined) {
      this.unlinkFrom(managed.slug, managed.source)
      const bundle = join(this.storeDir(), managed.slug)
      if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, { recursive: true, force: true })
      this.dropEntry(managed.slug)
      return bundle
    }
    const target = kind === 'bundle' ? dirname(path) : path
    rmSync(target, { recursive: true, force: true })
    return target
  }

  // ── migration ───────────────────────────────────────────────────────────

  /**
   * One-shot migration: move every user-level skill into the store and link
   * back the ones that were enabled. Project-level skills stay in place —
   * moving them into `$DSH_HOME` would detach them from the repository that
   * owns them.
   *
   * Idempotent: a second call is a no-op. Individual failures are collected
   * rather than thrown, and the offending skill is simply left where it was.
   */
  migrate(): StoreOperation {
    const index = this.readStoreIndex()
    if (index.migratedAt !== undefined) {
      return { moved: 0, failures: index.failures ?? [] }
    }
    const roots = getRoots()
    const failures: StoreFailure[] = []
    let moved = 0
    for (const scan of [
      { path: roots.userSkillsDir, source: 'user-dsh' as SkillSource },
      { path: roots.agentsSkillsDir, source: 'user-agents' as SkillSource },
    ]) {
      for (const item of this.scanRoot(scan.path, scan.source)) {
        if (item.managed) continue
        const sourcePath = item.kind === 'bundle' ? dirname(item.path) : item.path
        try {
          this.adopt(sourcePath, item.kind, scan.source, item.enabled)
          moved++
        } catch (e) {
          failures.push({ path: sourcePath, reason: String((e as Error)?.message ?? e) })
        }
      }
    }
    // Persisting the marker is best effort too: if the store itself cannot be
    // written, reporting what happened beats throwing out of plugin startup —
    // and re-running later is the correct recovery anyway.
    const next = this.readStoreIndex()
    next.migratedAt = new Date().toISOString()
    next.failures = failures
    try { this.writeStoreIndex(next) } catch { /* reported through the result */ }
    return { moved, failures }
  }

  /**
   * Undo {@link migrate}: restore every stored skill to its original path and
   * drop the store manifest. The invocation flags are re-applied so a skill
   * that was disabled before the migration comes back disabled.
   */
  rollbackMigration(): StoreOperation {
    const index = this.readStoreIndex()
    const failures: StoreFailure[] = []
    let moved = 0
    for (const entry of index.entries) {
      const bundle = join(this.storeDir(), entry.slug)
      if (!existsSync(bundle)) continue
      this.unlinkFrom(entry.slug, entry.source)
      const origin = entry.origin
      if (origin === '') {
        failures.push({ path: bundle, reason: '缺少原始路径，已保留在储存器中' })
        continue
      }
      try {
        mkdirSync(dirname(origin), { recursive: true })
        if (extname(origin).toLowerCase() === '.md') {
          movePath(join(bundle, 'SKILL.md'), origin)
          writeFileSync(origin, toggleInvocation(readFileSync(origin, 'utf8'), entry.enabled), 'utf8')
          rmSync(bundle, { recursive: true, force: true })
        } else {
          movePath(bundle, origin)
          const mdPath = join(origin, 'SKILL.md')
          writeFileSync(mdPath, toggleInvocation(readFileSync(mdPath, 'utf8'), entry.enabled), 'utf8')
        }
        moved++
      } catch (e) {
        failures.push({ path: origin, reason: String((e as Error)?.message ?? e) })
      }
    }
    if (failures.length === 0) {
      try { rmSync(join(this.storeDir(), 'index.json'), { force: true }) } catch { /* ignore */ }
    }
    return { moved, failures }
  }

  /**
   * Undo a rollback: run the one-shot migration again.
   *
   * This is the uninstall page's "undo" for the skills half of 归还 — a skill
   * given back to its original location can be re-adopted into the store at
   * any time. A rollback that fully succeeded deleted the manifest, so
   * {@link migrate} would re-run on its own; when failures kept the manifest
   * alive, the marker has to be cleared first or migrate() would no-op.
   */
  reMigrate(): StoreOperation {
    const index = this.readStoreIndex()
    if (index.migratedAt !== undefined) {
      delete index.migratedAt
      try { this.writeStoreIndex(index) } catch { /* migrate() rewrites it */ }
    }
    return this.migrate()
  }

  /** Store state for the UI banner. */
    storeStatus(): StoreStatus {
      const dir = this.storeDir()
      const index = this.readStoreIndex()
      let enabled = 0
      for (const entry of index.entries) if (this.linkedSource(entry.slug) !== undefined) enabled++
      // Count what is really on disk, not just what the manifest knows: a
      // bundle an agent dropped in has no entry yet, but the banner should
      // still say the store holds it.
      const knownSlugs = new Set(index.entries.map((e) => e.slug))
      let extra = 0
      try {
        for (const slug of readdirSync(dir)) {
          if (slug.startsWith('.') || knownSlugs.has(slug)) continue
          if (existsSync(join(dir, slug, 'SKILL.md'))) extra++
        }
      } catch { /* store not created yet */ }
      return {
        root: storeRoot(),
        dir,
        migrated: index.migratedAt !== undefined,
        migratedAt: index.migratedAt,
        count: index.entries.length + extra,
        enabled,
        failures: index.failures ?? [],
      }
    }

  // ── import ──────────────────────────────────────────────────────────────

  /** Scan an arbitrary directory for importable skills. */
  scanSkills(dir: string): ScannedSkill[] {
    if (!existsSync(dir)) throw new Error('directory not found: ' + dir)
    const entries = readdirSync(dir, { withFileTypes: true })
    const items: ScannedSkill[] = []
    for (const entry of entries) {
      const name = entry.name
      if (!name || name[0] === '.') continue
      const full = join(dir, name)
      const kind = entryKind(full, entry)
      if (kind === 'directory') {
        const mdPath = join(full, 'SKILL.md')
        if (!existsSync(mdPath)) continue
        let raw: string
        try { raw = readFileSync(mdPath, 'utf8') } catch { continue }
        const parsed = parseSkillFile(raw)
        if (parsed !== null) items.push({ name: parsed.name, description: parsed.description, sourcePath: full, kind: 'bundle' })
      } else if (kind === 'file' && name.endsWith('.md') && name !== 'SKILL.md') {
        let raw: string
        try { raw = readFileSync(full, 'utf8') } catch { continue }
        const parsed = parseSkillFile(raw)
        if (parsed !== null) items.push({ name: parsed.name, description: parsed.description, sourcePath: full, kind: 'file' })
      }
    }
    return items
  }

    /** Import selected skills into the store as enabled bundles. */
    importSkills(items: ImportItem[]): ImportResult[] {
      const results: ImportResult[] = []
      const releaseDir = getRoots().userSkillsDir
      for (const it of items) {
        try {
          const slug = this.adopt(it.sourcePath, it.kind, 'user-dsh', true, releaseDir)
          results.push({ name: join(this.storeDir(), slug), ok: true })
        } catch (e) {
          results.push({ name: it.sourcePath, ok: false, reason: String((e as Error)?.message ?? e) })
        }
      }
      return results
    }
}

/** `{ managed, slug }` for a scanned entry, when it is a link into the store. */
function managedFields(store: string, full: string): Pick<SkillSummary, 'managed' | 'slug'> {
  const target = linkTarget(full)
  if (target === undefined) return { managed: false }
  const resolved = resolve(dirname(full), target)
  if (!inside(store, resolved)) return { managed: false }
  return { managed: true, slug: basename(resolved) }
}

/**
 * Move a path, falling back to copy+delete when the source and destination sit
 * on different devices (rename cannot cross them).
 */
