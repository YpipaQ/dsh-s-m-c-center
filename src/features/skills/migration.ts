/**
 * The one-shot adoption migration (and its rollback / re-run).
 *
 * First launch after the store landed moves every user-level native skill into
 * `S-M-C/skills` and leaves a link behind. Project-level skills are never
 * touched — they belong to their repository.
 *
 * Idempotent by a flag in the manifest (`migratedAt`), and best-effort
 * throughout: a skill that cannot be moved is collected as a failure and left
 * in place, still usable, because refusing to mount would be worse. The status
 * route surfaces whatever is left over.
 * @module
 */

import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { storeRoot, storeSkillsDir } from '../../shared/paths.ts'
import { admissionDoc, parseBundleDocs, parseFlatDoc } from '../../shared/frontmatter.ts'
import { movePath } from '../../shared/fs-utils.ts'
import type { SkillSource, StoreFailure, StoreOperation, StoreStatus } from '../../shared/protocol/index.ts'
import { entryKind, getRoots, isLink } from './roots.ts'
import { readLinks } from './links.ts'
import { linkedPathOf, removeLink } from './linking.ts'
import { readStoreIndex, writeStoreIndex } from './store-index.ts'
import { migrateToStore } from './adopt.ts'

/** Parse one bundle safely; undefined when it is not a skill. */
function parseBundleDir(full: string) {
  return parseBundleDocs(full)?.parsed
}

/** Parse one flat `.md` file safely; undefined when it is not a skill. */
function parseFlatFile(full: string) {
  return parseFlatDoc(full) ?? undefined
}

/**
 * One-shot migration: move every user-level native skill into the store and
 * link it back from `~/.dsh/skills`. Project-level skills stay in place.
 * Idempotent; individual failures are collected, not thrown.
 */
export function migrate(): StoreOperation {
  const index = readStoreIndex()
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
        ? parseBundleDir(full)
        : (kind === 'file' && name.endsWith('.md') && name !== 'DESCRIPTION.md' ? parseFlatFile(full) : undefined)
      if (parsed === undefined) continue
      try {
        migrateToStore(full, kind === 'directory' ? 'bundle' : 'file', scan.source)
        moved++
      } catch (e) {
        failures.push({ path: full, reason: String((e as Error)?.message ?? e) })
      }
    }
  }
  const next = readStoreIndex()
  next.migratedAt = new Date().toISOString()
  next.failures = failures
  try { writeStoreIndex(next) } catch { /* reported through the result */ }
  return { moved, failures }
}

/**
 * Undo {@link migrate}: restore every stored skill to its original path
 * (removing links along the way) and drop the manifest.
 */
export function rollbackMigration(): StoreOperation {
  const index = readStoreIndex()
  const failures: StoreFailure[] = []
  let moved = 0
  for (const entry of index.entries) {
    const bundle = join(storeSkillsDir(), entry.slug)
    if (!existsSync(bundle)) continue
    try {
      if (entry.origin === '') {
        failures.push({ path: bundle, reason: '缺少原始路径，已保留在储存器中' })
        continue
      }
      const asFile = extname(entry.origin).toLowerCase() === '.md'
      removeLink(entry.slug)
      mkdirSync(dirname(entry.origin), { recursive: true })
      if (asFile) {
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
    try { rmSync(join(storeSkillsDir(), 'index.json'), { force: true }) } catch { /* ignore */ }
  }
  return { moved, failures }
}

/**
 * Undo a rollback: run the one-shot migration again (the uninstall page's
 * "undo" for the skills half of 归还).
 */
export function reMigrate(): StoreOperation {
  const index = readStoreIndex()
  if (index.migratedAt !== undefined) {
    delete index.migratedAt
    try { writeStoreIndex(index) } catch { /* migrate() rewrites it */ }
  }
  return migrate()
}

/** Store state for the UI banner. */
export function storeStatus(): StoreStatus {
  const dir = storeSkillsDir()
  const index = readStoreIndex()
  let linked = 0
  for (const entry of index.entries) {
    if (linkedPathOf(entry.slug) !== undefined) linked++
  }
  // Count what is really on disk, not just what the manifest knows.
  const knownSlugs = new Set(index.entries.map((e) => e.slug))
  let extra = 0
  try {
    for (const slug of readdirSync(dir)) {
      if (slug.startsWith('.') || knownSlugs.has(slug)) continue
      if (admissionDoc(join(dir, slug)) !== undefined) extra++
    }
  } catch { /* store not created yet */ }
  const untracked = readLinks().links.filter((l) => !isLink(l.linkPath)).length
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
