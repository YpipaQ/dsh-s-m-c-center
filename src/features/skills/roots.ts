/**
 * The roots the skills feature walks, and the primitive that tells a real
 * entry apart from a link.
 *
 * A skill can live in four places, and which one decides its level:
 * project-level roots are derived from the workspace cwd, user-level roots
 * from the home directory. Only the user-level roots are ever adopted into the
 * store — project skills are meant to travel with their repository.
 * @module
 */

import { mkdirSync, readdirSync, readlinkSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { existsSync } from 'node:fs'
import { dshHomeDir, storeSkillsDir } from '../../shared/paths.ts'
import type { SkillSource } from '../../shared/protocol/index.ts'

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

/** `$DSH_AGENTS_HOME`, falling back to `~/.agents`. */
function agentsHomeDir(): string {
  return process.env.DSH_AGENTS_HOME || join(homedir(), '.agents')
}

/**
 * True when `child` is `parent` or lives beneath it.
 *
 * Case-insensitive on Windows, where the same directory has many spellings and
 * a case-sensitive compare would report a store copy as "outside the store".
 */
export function inside(parent: string, child: string): boolean {
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
export function isLink(path: string): boolean {
  try { readlinkSync(path); return true } catch { return false }
}

/**
 * Link target, or undefined when `path` is a real file/directory.
 *
 * Returned raw (not resolved): callers always know the link's directory and
 * resolve against it, and `relinkSkills` needs the original string form.
 */
export function linkTarget(path: string): string | undefined {
  try { return readlinkSync(path) } catch { return undefined }
}

/**
 * Resolve a directory entry to a usable kind, following links.
 *
 * A junction reports `isSymbolicLink()` and neither `isDirectory()` nor
 * `isFile()`, so a naive scan silently skips every linked skill. This mirrors
 * dsh's own `nodeEntryKind` so the UI and the agent agree on what exists.
 */
export function entryKind(fullPath: string, entry: Dirent): 'directory' | 'file' | undefined {
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

/**
 * Walk up from cwd to the nearest `.git` directory (the project root).
 *
 * When no marker exists anywhere above — the usual case for a plain folder of
 * notes or a scratch area — the answer is **the directory we started in**, never
 * the volume root. Climbing past it put every such conversation's data in one
 * bucket at `G:\`/`C:\`: unrelated projects shared a single selection, the
 * files sat where nobody would think to look, and the workspace that owns them
 * appeared to have none at all.
 */
export function findProjectRoot(cwd?: string): string {
  const start = resolve(cwd ?? process.cwd())
  let current = start
  let hops = 0
  while (hops++ < MAX_ROOT_HOPS) {
    if (existsSync(join(current, PROJECT_MARKER))) return current
    const parent = dirname(current)
    if (parent === current) break // volume root: no project marker anywhere
    current = parent
  }
  return start
}

/** Project-level sources are the ones that belong to a workspace. */
export function levelOf(source: SkillSource): 'project' | 'user' {
  return source.startsWith('project') ? 'project' : 'user'
}

/**
 * The roots to walk for a listing, in display order: project, then user.
 *
 * Order matters — it is the tie-breaker when two roots hold a skill of the
 * same name, and the caller sorts by the entries' `source` afterwards anyway.
 */
export function scanTargets(cwd?: string): Array<{ path: string; source: SkillSource }> {
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
 * Every slug-shaped name directly under a directory, dotfiles excluded.
 *
 * Used where a collision-free slug is needed (the store, a registry scan):
 * a missing or unreadable directory yields an empty list rather than throwing,
 * because the caller is about to create it anyway.
 */
export function childNames(dir: string): string[] {
  try { return readdirSync(dir).filter((n) => !n.startsWith('.')) } catch { return [] }
}
