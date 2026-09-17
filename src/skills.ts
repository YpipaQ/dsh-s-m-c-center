/**
 * Skills filesystem engine — the real-level manager behind the four groups:
 *
 * 1. **native** — skills sitting as real files/directories in a scanned root
 *    (`~/.dsh/skills`, `~/.agents/skills`, or the project roots). Migrating one
 *    moves the canonical copy into the store and replaces the original with a
 *    link.
 * 2. **stored** — canonical copies under `~/.dsh/S-M-C/skills/<slug>/` (with
 *    `index.json` as the manifest).
 * 3. **registered** — external skills whose canonical copy stays wherever the
 *    user pointed at; only a record in `skills-registry.json` marks them.
 * 4. **links** — the junctions themselves, always under `~/.dsh/skills`, every
 *    one of them written down in `skills-links.json` when created so it can be
 *    audited and precisely undone. A link found on disk without a ledger
 *    record is reported as untracked (red flag) instead of silently adopted.
 *
 * Every registration runs the same safety flow: walk the candidate directory
 * level by level until a SKILL.md shows up, require a parseable frontmatter
 * (name + description), and only then write the record. SKILL.md files are
 * never rewritten — visibility is decided by link presence, and the per-skill
 * announcement flag lives in the JSON ledgers, not in the file.
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
  LinkRecord, RegistryEntry, ScannedSkill, SkillDetail, SkillGroup,
  SkillSource, SkillSummary, SkillLinks, SkillsRegistry, StoreEntry,
  StoreFailure, StoreIndex, StoreOperation, StoreStatus, VerifyResult,
} from './protocol.ts'
import {
  dshHomeDir, movePath, storeRoot, storeSkillsDir,
  storeSkillsRegistryPath, storeSkillsLinksPath,
} from './store.ts'

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
 * can recognise an old layout and move it.
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
function levelOf(source: SkillSource): SkillLevelOf {
  return source.startsWith('project') ? 'project' : 'user'
}

/** Alias so the protocol import stays a type-only concern. */
type SkillLevelOf = SkillSummary['level']

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

interface ParsedSkill { name: string; description: string; whenToUse: string; content: string }

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
  return {
    name,
    description,
    whenToUse: textField(front.data, 'whenToUse'),
    content: front.body.trim(),
  }
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

/** Link kind: junctions need no elevation on Windows, symlinks elsewhere. */
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir'

/** Cap for one imported skill's on-disk size. */
export const MAX_SKILL_BYTES = 10 * 1024 * 1024 * 1024

/** How deep {@link SkillsManager.scanSkills} descends below the picked root. */
export const SCAN_DEPTH = 2

/** Recursively sum the on-disk size of a directory or file. */
function treeSize(path: string): number {
  let info
  try { info = statSync(path) } catch { return 0 }
  if (!info.isDirectory()) return info.size
  let total = 0
  try {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      total += treeSize(join(path, entry.name))
      if (total > MAX_SKILL_BYTES) return total // early out
    }
  } catch { /* unreadable entries contribute 0 */ }
  return total
}

export class SkillsManager {
  /** The skills directory (created on demand inside the unified store root). */
  storeDir(): string {
    return storeSkillsDir()
  }

  // ── store manifest (group 2: stored) ─────────────────────────────────────

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
        announce: true,
        adoptedAt: new Date().toISOString(),
      })
    }
    return { version: 1, entries }
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

  /** Manifest entry for one slug, when present. */
  private entryOf(slug: string): StoreEntry | undefined {
    return this.readStoreIndex().entries.find((e) => e.slug === slug)
  }

  // ── registry ledger (group 3: registered + native announce flags) ────────

  /** Read the external-skills registry, tolerating a missing or corrupt file. */
  readRegistry(): SkillsRegistry {
    const file = storeSkillsRegistryPath()
    if (!existsSync(file)) return { version: 1, entries: [] }
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as SkillsRegistry).entries)) {
        throw new Error('malformed registry')
      }
      return parsed as SkillsRegistry
    } catch {
      return { version: 1, entries: [] }
    }
  }

  /** Write the registry atomically. */
  private writeRegistry(reg: SkillsRegistry): void {
    mkdirSync(storeRoot(), { recursive: true })
    const file = storeSkillsRegistryPath()
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8')
    renameSync(tmp, file)
  }

  /** Replace (or insert) one registry entry. */
  private upsertRegistryEntry(entry: RegistryEntry): void {
    const reg = this.readRegistry()
    const idx = reg.entries.findIndex((e) => e.slug === entry.slug)
    if (idx >= 0) reg.entries[idx] = entry
    else reg.entries.push(entry)
    this.writeRegistry(reg)
  }

  /** Drop one registry entry by slug. */
  private dropRegistryEntry(slug: string): void {
    const reg = this.readRegistry()
    reg.entries = reg.entries.filter((e) => e.slug !== slug)
    this.writeRegistry(reg)
  }

  /** Registry entry for one slug, when present. */
  private registryEntryOf(slug: string): RegistryEntry | undefined {
    return this.readRegistry().entries.find((e) => e.slug === slug)
  }

  // ── link ledger (group 4: links) ─────────────────────────────────────────

  /** Read the link ledger, tolerating a missing or corrupt file. */
  readLinks(): SkillLinks {
    const file = storeSkillsLinksPath()
    if (!existsSync(file)) return { version: 1, links: [] }
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as SkillLinks).links)) {
        throw new Error('malformed link ledger')
      }
      return parsed as SkillLinks
    } catch {
      return { version: 1, links: [] }
    }
  }

  /** Write the link ledger atomically. */
  private writeLinks(links: SkillLinks): void {
    mkdirSync(storeRoot(), { recursive: true })
    const file = storeSkillsLinksPath()
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(links, null, 2), 'utf8')
    renameSync(tmp, file)
  }

  /** Ledger record for one link path, when present. */
  private linkRecordOf(linkPath: string): LinkRecord | undefined {
    const want = resolve(linkPath).toLowerCase()
    return this.readLinks().links.find((l) => resolve(l.linkPath).toLowerCase() === want)
  }

  /** Append one ledger record. */
  private trackLink(record: LinkRecord): void {
    const ledger = this.readLinks()
    const want = resolve(record.linkPath).toLowerCase()
    ledger.links = ledger.links.filter((l) => resolve(l.linkPath).toLowerCase() !== want)
    ledger.links.push(record)
    this.writeLinks(ledger)
  }

  /** Remove the ledger record for one link path. */
  private untrackLink(linkPath: string): void {
    const ledger = this.readLinks()
    const want = resolve(linkPath).toLowerCase()
    const next = ledger.links.filter((l) => resolve(l.linkPath).toLowerCase() !== want)
    if (next.length !== ledger.links.length) this.writeLinks({ version: 1, links: next })
  }

  // ── linking ──────────────────────────────────────────────────────────────

  /**
   * Create the link `~/.dsh/skills/<slug>` → `target` and write the ledger
   * record. Refuses to overwrite a real directory; a tracked link is a no-op.
   */
  private createLink(slug: string, target: string): void {
    const roots = getRoots()
    mkdirSync(roots.userSkillsDir, { recursive: true })
    const link = join(roots.userSkillsDir, slug)
    if (isLink(link)) return
    if (existsSync(link)) throw new Error('已存在同名条目：' + link)
    symlinkSync(resolve(target), link, LINK_TYPE)
    this.trackLink({
      slug,
      linkPath: link,
      targetPath: resolve(target),
      createdAt: new Date().toISOString(),
    })
  }

  /**
   * Remove the link `~/.dsh/skills/<slug>` and its ledger record. Only ever
   * removes a link — a real directory is left alone so a stray path can never
   * delete real skills.
   */
  private removeLink(slug: string): void {
    const link = join(getRoots().userSkillsDir, slug)
    this.untrackLink(link)
    if (!isLink(link)) return
    if (process.platform === 'win32') rmdirSync(link)
    else unlinkSync(link)
  }

  /** Which root currently holds a tracked/untracked link for `slug`, if any. */
  private linkedPath(slug: string): string | undefined {
    const link = join(getRoots().userSkillsDir, slug)
    if (!isLink(link)) return undefined
    return link
  }

  /**
   * Repoint every ledger-tracked link that targets `from` at `to`.
   *
   * A junction stores an absolute target string, so moving the store silently
   * breaks every link into it. This is the repair step the store-root
   * migration runs right after moving.
   */
  relinkSkills(from: string, to: string): number {
    const ledger = this.readLinks()
    const base = resolve(from)
    let count = 0
    for (const record of ledger.links) {
      if (!inside(base, record.targetPath)) continue
      const slug = record.slug
      const link = join(getRoots().userSkillsDir, slug)
      try {
        if (isLink(link)) {
          if (process.platform === 'win32') rmdirSync(link)
          else unlinkSync(link)
        }
        symlinkSync(join(to, basename(record.targetPath)), link, LINK_TYPE)
        this.trackLink({ ...record, linkPath: link, targetPath: join(to, basename(record.targetPath)) })
        count++
      } catch { /* the caller reports the state through a rescan */ }
    }
    // Links the ledger never saw still deserve a repair pass.
    for (const dir of [getRoots().userSkillsDir, getRoots().agentsSkillsDir]) {
      if (!existsSync(dir)) continue
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (!isLink(full)) continue
        const target = linkTarget(full)
        if (target === undefined || !inside(base, resolve(dir, target))) continue
        try {
          if (process.platform === 'win32') rmdirSync(full)
          else unlinkSync(full)
          symlinkSync(join(to, basename(target)), full, LINK_TYPE)
          count++
        } catch { /* rescan reports */ }
      }
    }
    return count
  }

  // ── adoption (native → stored) ───────────────────────────────────────────

  /**
   * Move one native skill into the store, link it back from
   * `~/.dsh/skills/<slug>`, record the link, and drop its registry entry
   * (the skill is a stored one now). The SKILL.md is copied verbatim — no
   * frontmatter rewriting, ever.
   * @returns the store slug.
   */
  migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string {
    const store = this.storeDir()
    mkdirSync(store, { recursive: true })
    const mdPath = kind === 'bundle' ? join(sourcePath, 'SKILL.md') : sourcePath
    const parsed = parseSkillFile(readFileSync(mdPath, 'utf8'))
    if (parsed === null) throw new Error('不是有效的技能文件：' + mdPath)
    const taken = new Set<string>(readdirSync(store).filter((n) => !n.startsWith('.')))
    const slug = uniqueSlug(taken, slugify(parsed.name || basename(sourcePath, extname(sourcePath))))
    const dest = join(store, slug)

    if (kind === 'bundle') movePath(sourcePath, dest)
    else {
      mkdirSync(dest, { recursive: true })
      movePath(sourcePath, join(dest, 'SKILL.md'))
    }

    const previous = this.registryEntryOf(slug) ?? this.registryEntryOf(slugify(parsed.name))
    const announce = previous?.announce ?? true
    this.dropRegistryEntry(slug)
    this.dropRegistryEntry(slugify(parsed.name))

    this.createLink(slug, dest)
    this.upsertEntry({
      slug,
      name: parsed.name,
      origin: sourcePath,
      announce,
      adoptedAt: new Date().toISOString(),
    })
    return slug
  }

  /**
   * Undo a migration: remove the link, move the canonical copy back to its
   * origin, and drop the manifest entry. The registry entry is restored so
   * the announcement flag survives the round trip.
   */
  unmigrate(slug: string): string {
    const entry = this.entryOf(slug)
    if (entry === undefined) throw new Error('储存库中没有这个技能：' + slug)
    const bundle = join(this.storeDir(), slug)
    if (!existsSync(bundle)) throw new Error('储存库副本已不存在：' + bundle)
    if (entry.origin === '') throw new Error('缺少原始路径，无法撤销迁移：' + slug)
    this.removeLink(slug)
    mkdirSync(dirname(entry.origin), { recursive: true })
    if (extname(entry.origin).toLowerCase() === '.md') {
      movePath(join(bundle, 'SKILL.md'), entry.origin)
      rmSync(bundle, { recursive: true, force: true })
    } else {
      movePath(bundle, entry.origin)
    }
    this.dropEntry(slug)
    this.upsertRegistryEntry({
      slug,
      name: entry.name,
      description: '',
      path: entry.origin,
      kind: extname(entry.origin).toLowerCase() === '.md' ? 'file' : 'bundle',
      origin: 'native',
      announce: entry.announce,
      registeredAt: new Date().toISOString(),
    })
    return entry.origin
  }

  /** Resolve a link path back to the skill it serves, or undefined. */
  private resolveByLink(linkPath: string): { slug: string; target: string } | undefined {
    const target = linkTarget(linkPath)
    if (target === undefined) return undefined
    const resolved = resolve(dirname(linkPath), target)
    const store = this.storeDir()
    if (inside(store, resolved)) return { slug: basename(resolved), target: resolved }
    const reg = this.readRegistry().entries.find((e) => inside(resolve(e.path), resolved) || resolve(e.path) === resolved)
    if (reg !== undefined) return { slug: reg.slug, target: resolved }
    return undefined
  }

  // ── link operations (public) ─────────────────────────────────────────────

  /** Create (or confirm) the link for a stored or registered skill. */
  linkSkill(slug: string): void {
    const stored = this.entryOf(slug)
    if (stored !== undefined) {
      this.createLink(slug, join(this.storeDir(), slug))
      return
    }
    const registered = this.registryEntryOf(slug)
    if (registered === undefined) throw new Error('找不到技能：' + slug)
    const target = registered.kind === 'file' ? dirname(registered.path) : registered.path
    this.createLink(slug, target)
  }

  /** Remove the link for a skill (the canonical copy is never touched). */
  unlinkSkill(slug: string): void {
    this.removeLink(slug)
  }

  /**
   * Verify a link: does it still resolve, and does the target still hold a
   * parseable SKILL.md? Used by the UI for red-flagged (untracked) links.
   */
  verifyLink(slugOrPath: string): VerifyResult {
    const link = existsSync(slugOrPath) && isLink(slugOrPath)
      ? slugOrPath
      : join(getRoots().userSkillsDir, slugOrPath)
    if (!isLink(link)) return { ok: false, reason: '不是联接：' + link }
    const target = linkTarget(link)
    if (target === undefined) return { ok: false, reason: '联接目标不可读：' + link }
    const resolved = resolve(dirname(link), target)
    if (!existsSync(resolved)) return { ok: false, reason: '联接目标已不存在：' + resolved }
    const mdPath = statSync(resolved).isDirectory() ? join(resolved, 'SKILL.md') : resolved
    if (!existsSync(mdPath)) return { ok: false, reason: '联接目标里没有 SKILL.md：' + resolved }
    const tracked = this.linkRecordOf(link) !== undefined
    const stored = inside(this.storeDir(), resolved)
    return { ok: true, tracked, stored, target: resolved, mdPath }
  }

  /** Delete an untracked link (the ledger has no record of it). */
  deleteUntrackedLink(linkPath: string): void {
    if (!isLink(linkPath)) throw new Error('不是联接：' + linkPath)
    if (this.linkRecordOf(linkPath) !== undefined) {
      throw new Error('联接有账本记录，请用常规取消联接：' + linkPath)
    }
    if (process.platform === 'win32') rmdirSync(linkPath)
    else unlinkSync(linkPath)
  }

  // ── registry operations (public) ─────────────────────────────────────────

  /**
   * Register external skills: the canonical copy stays where it is, only a
   * record goes into `skills-registry.json`. This is the flow for "skills in
   * arbitrary directories" per the four-group model.
   */
  registerExternal(items: Array<{ sourcePath: string; kind: 'bundle' | 'file' }>): Array<{ name: string; ok: boolean; reason?: string }> {
    const results: Array<{ name: string; ok: boolean; reason?: string }> = []
    for (const it of items) {
      try {
        const mdPath = it.kind === 'bundle' ? join(it.sourcePath, 'SKILL.md') : it.sourcePath
        const parsed = parseSkillFile(readFileSync(mdPath, 'utf8'))
        if (parsed === null) throw new Error('不是有效的技能文件：' + mdPath)
        const taken = new Set<string>([
          ...this.readRegistry().entries.map((e) => e.slug),
          ...this.readStoreIndex().entries.map((e) => e.slug),
        ])
        const slug = uniqueSlug(taken, slugify(parsed.name || basename(it.sourcePath, extname(it.sourcePath))))
        this.upsertRegistryEntry({
          slug,
          name: parsed.name,
          description: parsed.description,
          path: it.sourcePath,
          kind: it.kind,
          origin: 'external',
          announce: true,
          registeredAt: new Date().toISOString(),
        })
        results.push({ name: parsed.name, ok: true })
      } catch (e) {
        results.push({ name: it.sourcePath, ok: false, reason: String((e as Error)?.message ?? e) })
      }
    }
    return results
  }

  /** Drop a registry entry (and its link, when one exists). */
  unregisterExternal(slug: string): void {
    this.removeLink(slug)
    this.dropRegistryEntry(slug)
  }

  /**
   * Walk the registry and refresh `lastSeen`: the cheap traceability pass that
   * only checks whether the canonical path still exists — no content parsing.
   */
  refreshRegistry(): Array<{ slug: string; name: string; exists: boolean }> {
    const reg = this.readRegistry()
    const out: Array<{ slug: string; name: string; exists: boolean }> = []
    for (const entry of reg.entries) {
      const exists = existsSync(entry.path)
      entry.lastSeen = exists ? new Date().toISOString() : entry.lastSeen
      out.push({ slug: entry.slug, name: entry.name, exists })
    }
    this.writeRegistry(reg)
    return out
  }

  /** The announcement flag for one skill, from whichever ledger holds it. */
  setAnnounce(group: SkillGroup, slug: string, announce: boolean): void {
    if (group === 'stored') {
      const entry = this.entryOf(slug)
      if (entry === undefined) throw new Error('储存库中没有这个技能：' + slug)
      this.upsertEntry({ ...entry, announce })
      return
    }
    const entry = this.registryEntryOf(slug)
    if (entry === undefined) throw new Error('登记表中没有这个技能：' + slug)
    this.upsertRegistryEntry({ ...entry, announce })
  }

  // ── scanning / listing ───────────────────────────────────────────────────

  /** Parse one SKILL.md (bundle) safely; undefined when it is not a skill. */
  private parseBundleDir(full: string): ParsedSkill | undefined {
    const mdPath = join(full, 'SKILL.md')
    if (!existsSync(mdPath)) return undefined
    try { return parseSkillFile(readFileSync(mdPath, 'utf8')) ?? undefined } catch { return undefined }
  }

  /** Parse one flat `.md` file safely; undefined when it is not a skill. */
  private parseFlatFile(full: string): ParsedSkill | undefined {
    try { return parseSkillFile(readFileSync(full, 'utf8')) ?? undefined } catch { return undefined }
  }

  /**
   * Walk one skill root and produce rows for everything found there. Real
   * directories/files become native rows (auto-registered); links become
   * linked rows whose group follows the link target (stored / registered),
   * or untracked red-flag rows when the ledger has no record of them.
   */
  private scanRootInto(dir: string, source: SkillSource, seen: Set<string>, items: SkillSummary[]): void {
    if (!existsSync(dir)) return
    let entries: Dirent[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    const store = this.storeDir()
    for (const entry of entries) {
      const name = entry.name
      if (!name || name === '.system' || name[0] === '.') continue
      const full = join(dir, name)
      const kind = entryKind(full, entry)
      if (kind === undefined) continue

      // Linked entry: the interesting case.
      if (isLink(full)) {
        if (seen.has(full)) continue
        seen.add(full)
        const target = linkTarget(full)
        const resolved = target === undefined ? undefined : resolve(dir, target)
        const tracked = this.linkRecordOf(full)
        const parsed = resolved !== undefined && existsSync(resolved)
          ? (statSync(resolved).isDirectory() ? this.parseBundleDir(resolved) : this.parseFlatFile(resolved))
          : undefined
        if (resolved === undefined) continue
        const stored = inside(store, resolved)
        const slug = stored ? basename(resolved) : (tracked?.slug ?? this.registryEntryOfByPath(resolved)?.slug ?? slugify(name))
        items.push({
          name: parsed?.name ?? name,
          description: parsed?.description ?? '',
          whenToUse: parsed?.whenToUse ?? '',
          group: stored ? 'stored' : 'registered',
          announce: stored
            ? (this.entryOf(slug)?.announce ?? true)
            : (this.registryEntryOf(slug)?.announce ?? this.registryEntryOfByPath(resolved)?.announce ?? true),
          linked: true,
          untracked: tracked === undefined,
          source,
          level: levelOf(source),
          kind: 'bundle',
          path: stored ? join(store, slug, 'SKILL.md') : resolved,
          slug,
        })
        continue
      }

      // Real file/directory: a native skill (or something that is not one).
      const parsed = kind === 'directory' ? this.parseBundleDir(full) : (name.endsWith('.md') ? this.parseFlatFile(full) : undefined)
      if (parsed === undefined) continue
      if (seen.has(full)) continue
      seen.add(full)
      const slug = slugify(parsed.name)
      // Auto-register so the announcement flag has a home ("find one → record it").
      const known = this.registryEntryOf(slug)
      if (known === undefined || known.origin !== 'native') {
        this.upsertRegistryEntry({
          slug,
          name: parsed.name,
          description: parsed.description,
          path: kind === 'directory' ? full : full,
          kind: kind === 'directory' ? 'bundle' : 'file',
          origin: 'native',
          announce: known?.announce ?? true,
          registeredAt: known?.registeredAt ?? new Date().toISOString(),
        })
      }
      items.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        group: 'native',
        announce: known?.announce ?? true,
        linked: false,
        source,
        level: levelOf(source),
        kind: kind === 'directory' ? 'bundle' : 'file',
        path: kind === 'directory' ? join(full, 'SKILL.md') : full,
        slug,
      })
    }
  }

  /** Registry entry whose canonical path matches `resolved`. */
  private registryEntryOfByPath(resolved: string): RegistryEntry | undefined {
    const want = resolve(resolved).toLowerCase()
    return this.readRegistry().entries.find((e) => {
      const base = e.kind === 'file' ? dirname(resolve(e.path)) : resolve(e.path)
      return base.toLowerCase() === want || want.startsWith(base.toLowerCase() + sep.toLowerCase())
    })
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
   * List every skill across the four groups, de-duplicated by path: native
   * roots first, then stored-but-unlinked rows, then registered-but-unlinked
   * rows. Announce flags come from the ledgers; link presence comes from the
   * filesystem cross-checked against the link ledger.
   */
  listSkills(cwd?: string): SkillSummary[] {
    const seen = new Set<string>()
    const items: SkillSummary[] = []
    for (const target of this.scanTargets(cwd)) {
      this.scanRootInto(target.path, target.source, seen, items)
    }

    const store = this.storeDir()
    // Stored skills with no link in any scanned root still need a row (so
    // they can be linked or unmigrated). The scan covers linked ones already.
    const linkedSlugs = new Set(items.filter((i) => i.group === 'stored').map((i) => i.slug))
    for (const entry of this.readStoreIndex().entries) {
      if (linkedSlugs.has(entry.slug)) continue
      const mdPath = join(store, entry.slug, 'SKILL.md')
      if (seen.has(mdPath)) continue
      if (this.linkedPath(entry.slug) !== undefined) continue
      let parsed: ParsedSkill | null = null
      try { parsed = parseSkillFile(readFileSync(mdPath, 'utf8')) } catch { continue }
      if (parsed === null) continue
      seen.add(mdPath)
      items.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        group: 'stored',
        announce: entry.announce,
        linked: false,
        source: 'user-dsh',
        level: 'user',
        kind: 'bundle',
        path: mdPath,
        slug: entry.slug,
      })
    }
    // Bundles dropped straight into the store — an agent following the
    // announcement's guidance — get adopted into the manifest on sight.
    const knownSlugs = new Set(this.readStoreIndex().entries.map((e) => e.slug))
    let stored: string[] = []
    try { stored = readdirSync(store) } catch { /* store not created yet */ }
    for (const slug of stored) {
      if (slug.startsWith('.') || knownSlugs.has(slug)) continue
      const mdPath = join(store, slug, 'SKILL.md')
      if (!existsSync(mdPath)) continue
      const parsed = this.parseBundleDir(join(store, slug))
      if (parsed === undefined) continue
      this.upsertEntry({
        slug,
        name: parsed.name,
        origin: '',
        announce: false,
        adoptedAt: new Date().toISOString(),
      })
      if (seen.has(mdPath)) continue
      seen.add(mdPath)
      items.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        group: 'stored',
        announce: false,
        linked: false,
        source: 'user-dsh',
        level: 'user',
        kind: 'bundle',
        path: mdPath,
        slug,
      })
    }
    // Registered-but-unlinked external skills need their rows too.
    const regLinked = new Set(items.filter((i) => i.group === 'registered' && i.linked).map((i) => i.slug))
    for (const entry of this.readRegistry().entries) {
      if (entry.origin !== 'external' || regLinked.has(entry.slug)) continue
      if (this.linkedPath(entry.slug) !== undefined) continue
      const mdPath = entry.kind === 'bundle' ? join(entry.path, 'SKILL.md') : entry.path
      if (seen.has(mdPath)) continue
      seen.add(mdPath)
      items.push({
        name: entry.name,
        description: entry.description,
        whenToUse: '',
        group: 'registered',
        announce: entry.announce,
        linked: false,
        source: 'user-dsh',
        level: 'user',
        kind: entry.kind,
        path: mdPath,
        slug: entry.slug,
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

  // ── deletion ─────────────────────────────────────────────────────────────

  /**
   * Delete a skill wherever it lives: native → the real file goes; stored →
   * link, ledger record, manifest entry and store copy all go; registered →
   * link and registry record go, the external canonical copy stays.
   */
  deleteSkill(path: string, kind: 'bundle' | 'file'): string {
    const store = this.storeDir()

    // Reached through a link: identify the skill by the link target, never by
    // following the path (a rmSync past a junction would gut the store copy).
    const link = dirname(path)
    if (isLink(link)) {
      const target = linkTarget(link)
      const resolved = target === undefined ? undefined : resolve(link, target)
      const slug = basename(link)
      this.removeLink(slug)
      if (resolved !== undefined && inside(store, resolved)) {
        const bundle = join(store, slug)
        if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, { recursive: true, force: true })
        this.dropEntry(slug)
        return bundle
      }
      const reg = resolved === undefined
        ? undefined
        : this.readRegistry().entries.find((e) => inside(resolve(e.path), resolved))
      if (reg !== undefined) this.dropRegistryEntry(reg.slug)
      return link
    }

    // Stored: the SKILL.md path sits inside the store directory itself.
    if (inside(store, path)) {
      const slug = basename(dirname(path))
      this.removeLink(slug)
      const bundle = join(store, slug)
      if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, { recursive: true, force: true })
      this.dropEntry(slug)
      this.dropRegistryEntry(slug)
      return bundle
    }

    // Registered external: the link (if any) and the record go; the files stay.
    const reg = this.readRegistry().entries.find((e) =>
      resolve(e.path).toLowerCase() === resolve(dirname(path)).toLowerCase()
      || resolve(path).toLowerCase() === resolve(e.path).toLowerCase(),
    )
    if (reg !== undefined) {
      this.removeLink(reg.slug)
      this.dropRegistryEntry(reg.slug)
      return reg.path
    }

    // Native: delete the real thing (no link involved at this point).
    const target = kind === 'bundle' ? dirname(path) : path
    const slug = slugify(basename(target))
    this.removeLink(slug)
    this.dropRegistryEntry(slug)
    rmSync(target, { recursive: true, force: true })
    return target
  }

  // ── one-shot migration (uninstall-page compatible) ───────────────────────

  /**
   * One-shot migration: move every user-level native skill into the store and
   * link it back from `~/.dsh/skills`. Project-level skills stay in place.
   * Idempotent; individual failures are collected, not thrown.
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
      if (!existsSync(scan.path)) continue
      let entries: Dirent[] = []
      try { entries = readdirSync(scan.path, { withFileTypes: true }) } catch { continue }
      for (const entry of entries) {
        const name = entry.name
        if (!name || name[0] === '.') continue
        const full = join(scan.path, name)
        if (isLink(full)) continue
        const kind = entryKind(full, entry)
        const parsed = kind === 'directory'
          ? this.parseBundleDir(full)
          : (kind === 'file' && name.endsWith('.md') ? this.parseFlatFile(full) : undefined)
        if (parsed === undefined) continue
        try {
          this.migrateToStore(
            full,
            kind === 'directory' ? 'bundle' : 'file',
            scan.source,
          )
          moved++
        } catch (e) {
          failures.push({ path: full, reason: String((e as Error)?.message ?? e) })
        }
      }
    }
    const next = this.readStoreIndex()
    next.migratedAt = new Date().toISOString()
    next.failures = failures
    try { this.writeStoreIndex(next) } catch { /* reported through the result */ }
    return { moved, failures }
  }

  /**
   * Undo {@link migrate}: restore every stored skill to its original path
   * (removing links along the way) and drop the manifest.
   */
  rollbackMigration(): StoreOperation {
    const index = this.readStoreIndex()
    const failures: StoreFailure[] = []
    let moved = 0
    for (const entry of index.entries) {
      const bundle = join(this.storeDir(), entry.slug)
      if (!existsSync(bundle)) continue
      try {
        if (entry.origin === '') {
          failures.push({ path: bundle, reason: '缺少原始路径，已保留在储存器中' })
          continue
        }
        this.removeLink(entry.slug)
        mkdirSync(dirname(entry.origin), { recursive: true })
        if (extname(entry.origin).toLowerCase() === '.md') {
          movePath(join(bundle, 'SKILL.md'), entry.origin)
          rmSync(bundle, { recursive: true, force: true })
        } else {
          movePath(bundle, entry.origin)
        }
        moved++
      } catch (e) {
        failures.push({ path: entry.origin, reason: String((e as Error)?.message ?? e) })
      }
    }
    if (failures.length === 0) {
      try { rmSync(join(this.storeDir(), 'index.json'), { force: true }) } catch { /* ignore */ }
    }
    return { moved, failures }
  }

  /**
   * Undo a rollback: run the one-shot migration again (the uninstall page's
   * "undo" for the skills half of 归还).
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
    let linked = 0
    for (const entry of index.entries) {
      if (this.linkedPath(entry.slug) !== undefined) linked++
    }
    // Count what is really on disk, not just what the manifest knows.
    const knownSlugs = new Set(index.entries.map((e) => e.slug))
    let extra = 0
    try {
      for (const slug of readdirSync(dir)) {
        if (slug.startsWith('.') || knownSlugs.has(slug)) continue
        if (existsSync(join(dir, slug, 'SKILL.md'))) extra++
      }
    } catch { /* store not created yet */ }
    const untracked = this.readLinks().links.filter((l) => !isLink(l.linkPath)).length
    return {
      root: storeRoot(),
      dir,
      migrated: index.migratedAt !== undefined,
      migratedAt: index.migratedAt,
      count: index.entries.length + extra,
      linked,
      failures: index.failures ?? [],
      untracked,
    }
  }

  // ── external scan (import candidates) ────────────────────────────────────

  /**
   * Scan an arbitrary directory for importable skills: the root plus two
   * levels of sub-directories, skipping anything bigger than 10 GB. Every
   * hit is a *registration* candidate — the canonical copy stays in place.
   */
  scanSkills(dir: string): ScannedSkill[] {
    if (!existsSync(dir)) throw new Error('directory not found: ' + dir)
    const items: ScannedSkill[] = []
    const seen = new Set<string>()
    const walk = (current: string, depth: number): void => {
      let entries: Dirent[] = []
      try { entries = readdirSync(current, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const name = entry.name
        if (!name || name[0] === '.') continue
        const full = join(current, name)
        if (seen.has(full)) continue
        const kind = entryKind(full, entry)
        if (kind === 'directory') {
          const parsed = this.parseBundleDir(full)
          if (parsed !== undefined) {
            seen.add(full)
            const size = treeSize(full)
            items.push({
              name: parsed.name,
              description: parsed.description,
              sourcePath: full,
              kind: 'bundle',
              oversize: size > MAX_SKILL_BYTES,
              size,
            })
            continue
          }
          if (depth < SCAN_DEPTH) walk(full, depth + 1)
        } else if (kind === 'file' && name.endsWith('.md') && name !== 'SKILL.md') {
          const parsed = this.parseFlatFile(full)
          if (parsed !== undefined) {
            seen.add(full)
            items.push({
              name: parsed.name,
              description: parsed.description,
              sourcePath: full,
              kind: 'file',
              oversize: false,
              size: treeSize(full),
            })
          }
        }
      }
    }
    walk(dir, 0)
    return items
  }
}
