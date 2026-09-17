/**
 * The store manifest (`S-M-C/skills/index.json`) — group 2's ledger.
 *
 * One row per adopted skill: its slug, the name it had when adopted, where it
 * came from (so an unmigrate can put it back), and its announcement flag. Link
 * state is deliberately *not* here — that belongs to the link ledger, and
 * keeping them apart is what lets a link be rebuilt without touching the
 * manifest.
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
      announce: true,
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
    return parsed as StoreIndex
  } catch {
    try { copyFileSync(file, join(dir, 'index.corrupt.json')) } catch { /* best effort */ }
    const recovered = recoverIndex()
    writeStoreIndex(recovered)
    return recovered
  }
}

/** Write the manifest atomically (temp file + rename). */
export function writeStoreIndex(index: StoreIndex): void {
  const dir = storeSkillsDir()
  mkdirSync(dir, { recursive: true })
  const file = storeIndexPath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8')
  renameSync(tmp, file)
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
