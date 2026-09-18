/**
 * The store manifest (`S-M-C/skills/index.json`) — group 2's ledger.
 *
 * One row per adopted skill: its slug, the name it had when adopted, and where
 * it came from (so an unmigrate can put it back). Link state is deliberately
 * *not* here — that belongs to the link ledger, and keeping them apart is what
 * lets a link be rebuilt without touching the manifest.
 *
 * A row is written in exactly one shape ({@link ENTRY_KEYS}). An earlier
 * version also kept a per-skill 公告 flag, a 启用 flag, a link flag and a
 * source id on every row; by the end none of them controlled anything (the 公告
 * switch was removed for precisely that reason), but a stale key in a
 * user-visible file reads as a live one — so every write drops them, and
 * {@link compactStoreIndex} converges a file that already carries them.
 *
 * Reads are defensive: a missing file rebuilds the manifest from whatever
 * bundles exist on disk, and a corrupt file is preserved as
 * `index.corrupt.json` before that rebuild, so a bad write never loses the
 * record silently.
 * @module
 */

import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { parseBundleDocs } from '../../shared/frontmatter.ts'
import type { StoreEntry, StoreIndex } from '../../shared/protocol/index.ts'
import { storeSkillsDir } from '../../shared/paths.ts'

/** File name of the manifest inside the skills directory. */
export const STORE_INDEX_NAME = 'index.json'

/** The only keys one manifest row may carry. */
export const ENTRY_KEYS: readonly string[] = ['slug', 'name', 'origin', 'adoptedAt']

/** The only top-level keys the manifest may carry. */
const TOP_LEVEL_KEYS: readonly string[] = ['version', 'entries', 'migratedAt', 'failures']

/** Path of the store manifest. */
export function storeIndexPath(): string {
  return join(storeSkillsDir(), STORE_INDEX_NAME)
}

/** An empty manifest. */
export function emptyIndex(): StoreIndex {
  return { version: 1, entries: [] }
}

/**
 * Rebuild the manifest from whatever bundles exist in the store directory.
 *
 * Used when index.json is missing (first run after a manual copy, or a corrupt
 * file) so adopted skills are not silently orphaned. No origin is recorded —
 * there is none to recover — which reads as "cannot be unmigrated".
 */
export function recoverIndex(): StoreIndex {
  const dir = storeSkillsDir()
  const entries: StoreEntry[] = []
  if (!existsSync(dir)) return emptyIndex()
  let names: string[] = []
  try { names = readdirSync(dir) } catch { return emptyIndex() }
  for (const slug of names) {
    if (slug.startsWith('.')) continue
    const parsed = parseBundleDocs(join(dir, slug))?.parsed
    if (parsed === undefined) continue
    entries.push({
      slug,
      name: parsed.name,
      origin: '',
      adoptedAt: new Date().toISOString(),
    })
  }
  return { version: 1, entries }
}

/**
 * Read the store manifest, rebuilding it from disk when missing or corrupt.
 * A corrupt file is kept as `index.corrupt.json` rather than deleted.
 */
export function readStoreIndex(): StoreIndex {
  const dir = storeSkillsDir()
  const file = storeIndexPath()
  if (!existsSync(file)) return recoverIndex()
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as StoreIndex).entries)) {
      throw new Error('malformed store index')
    }
    return canonicalIndex(parsed as StoreIndex)
  } catch {
    try { copyFileSync(file, join(dir, 'index.corrupt.json')) } catch { /* best effort */ }
    const recovered = recoverIndex()
    writeStoreIndex(recovered)
    return recovered
  }
}

/** One row reduced to the fields this version owns; undefined when unusable. */
function canonicalEntry(raw: unknown): StoreEntry | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const row = raw as Record<string, unknown>
  const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
  if (slug === '') return undefined
  return {
    slug,
    name: typeof row.name === 'string' && row.name !== '' ? row.name : slug,
    origin: typeof row.origin === 'string' ? row.origin : '',
    adoptedAt: typeof row.adoptedAt === 'string' ? row.adoptedAt : '',
  }
}

/**
 * The manifest reduced to the shape this version writes: the top-level keys it
 * owns, and rows that carry nothing else. Idempotent by construction — feeding
 * its own output back returns an equal object.
 */
export function canonicalIndex(index: StoreIndex): StoreIndex {
  const next: StoreIndex = { version: 1, entries: [] }
  for (const row of Array.isArray(index.entries) ? index.entries : []) {
    const entry = canonicalEntry(row)
    if (entry !== undefined) next.entries.push(entry)
  }
  if (typeof index.migratedAt === 'string' && index.migratedAt !== '') next.migratedAt = index.migratedAt
  if (Array.isArray(index.failures) && index.failures.length > 0) {
    next.failures = index.failures.map((f) => ({
      path: typeof f?.path === 'string' ? f.path : '',
      reason: typeof f?.reason === 'string' ? f.reason : '',
    }))
  }
  return next
}

/** Every key the file carries that this version does not own. */
function staleKeys(raw: StoreIndex): string[] {
  const found = new Set<string>()
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) found.add(key)
  }
  for (const row of Array.isArray(raw.entries) ? raw.entries : []) {
    if (typeof row !== 'object' || row === null) continue
    for (const key of Object.keys(row)) {
      if (!ENTRY_KEYS.includes(key)) found.add(key)
    }
  }
  return [...found]
}

/** Write the manifest atomically (temp file + rename), in canonical shape. */
export function writeStoreIndex(index: StoreIndex): void {
  const dir = storeSkillsDir()
  mkdirSync(dir, { recursive: true })
  const file = storeIndexPath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(canonicalIndex(index), null, 2), 'utf8')
  renameSync(tmp, file)
}

/**
 * Converge the manifest on disk onto the canonical shape, dropping keys an
 * older version left behind.
 *
 * Called once on mount: a write only ever touches one row, so a row that is
 * never adopted again would keep its dead keys forever. Idempotent — a file
 * that is already canonical is left alone, so this is free on every later boot.
 *
 * @returns whether the file changed, and the key names that were dropped.
 */
export function compactStoreIndex(): { changed: boolean; dropped: string[] } {
  const file = storeIndexPath()
  if (!existsSync(file)) return { changed: false, dropped: [] }
  let raw: unknown
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch {
    // readStoreIndex() owns corrupt-file recovery; leave this one to it.
    return { changed: false, dropped: [] }
  }
  if (typeof raw !== 'object' || raw === null) return { changed: false, dropped: [] }
  const current = raw as StoreIndex
  const next = canonicalIndex(current)
  if (JSON.stringify(current) === JSON.stringify(next)) return { changed: false, dropped: [] }
  writeStoreIndex(next)
  return { changed: true, dropped: staleKeys(current) }
}

/** Replace (or insert) one manifest entry. */
export function upsertEntry(entry: StoreEntry): void {
  const index = readStoreIndex()
  const idx = index.entries.findIndex((e) => e.slug === entry.slug)
  if (idx >= 0) index.entries[idx] = entry
  else index.entries.push(entry)
  writeStoreIndex(index)
}

/** Drop one manifest entry. */
export function dropEntry(slug: string): void {
  const index = readStoreIndex()
  index.entries = index.entries.filter((e) => e.slug !== slug)
  writeStoreIndex(index)
}

/** Manifest entry for one slug, when present. */
export function entryOf(slug: string): StoreEntry | undefined {
  return readStoreIndex().entries.find((e) => e.slug === slug)
}

/** Every manifest slug, for collision checks. */
export function storeSlugs(): string[] {
  return readStoreIndex().entries.map((e) => e.slug)
}
