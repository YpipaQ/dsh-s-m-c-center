/**
 * Registry operations: importing external skills, dropping them, and the
 * traceability pass.
 *
 * The registry is the ledger for skills that stay where they are, so these are
 * the flows that do *not* move anything — importing records a path, and the
 * refresh pass only checks whether that path is still there.
 * @module
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { parseBundleDocs, parseSkillFile, slugify, uniqueSlug } from '../../shared/frontmatter.ts'
import { removeLink } from './linking.ts'
import { readStoreIndex } from './store-index.ts'
import { dropRegistryEntry, readRegistry, upsertRegistryEntry, writeRegistry } from './registry.ts'

/**
 * Register external skills: the canonical copy stays where it is, only a
 * record goes into `skills-registry.json`. This is the flow for "skills in
 * arbitrary directories" per the four-group model.
 *
 * Per-item failures are collected rather than thrown, so one bad pick does not
 * abandon the rest of the batch.
 */
export function registerExternal(
  items: Array<{ sourcePath: string; kind: 'bundle' | 'file' }>,
): Array<{ name: string; ok: boolean; reason?: string }> {
  const results: Array<{ name: string; ok: boolean; reason?: string }> = []
  for (const it of items) {
    try {
      const parsed = it.kind === 'bundle'
        ? parseBundleDocs(it.sourcePath)?.parsed ?? null
        : parseSkillFile(readFileSync(it.sourcePath, 'utf8'))
      if (parsed === null) throw new Error('不是有效的技能文件：' + it.sourcePath)
      const taken = new Set<string>([
        ...readRegistry().entries.map((e) => e.slug),
        ...readStoreIndex().entries.map((e) => e.slug),
      ])
      const slug = uniqueSlug(taken, slugify(parsed.name || basename(it.sourcePath, extname(it.sourcePath))))
      upsertRegistryEntry({
        slug,
        name: parsed.name,
        description: parsed.description,
        path: it.sourcePath,
        kind: it.kind,
        origin: 'external',
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
export function unregisterExternal(slug: string): void {
  removeLink(slug)
  dropRegistryEntry(slug)
}

/**
 * Walk the registry and refresh `lastSeen`: the cheap traceability pass that
 * only checks whether the canonical path still exists — no content parsing.
 */
export function refreshRegistry(): Array<{ slug: string; name: string; exists: boolean }> {
  const reg = readRegistry()
  const out: Array<{ slug: string; name: string; exists: boolean }> = []
  for (const entry of reg.entries) {
    const found = existsSync(entry.path)
    entry.lastSeen = found ? new Date().toISOString() : entry.lastSeen
    out.push({ slug: entry.slug, name: entry.name, exists: found })
  }
  writeRegistry(reg)
  return out
}

/**
 * The registry entry a given skill path belongs to, for the delete flow.
 *
 * Matches the entry's own directory (so a bundle's SKILL.md resolves to it) or
 * the path itself (a flat `.md` row).
 */
export function registryEntryForDelete(path: string) {
  return readRegistry().entries.find((e) =>
    resolve(e.path).toLowerCase() === resolve(dirname(path)).toLowerCase()
    || resolve(path).toLowerCase() === resolve(e.path).toLowerCase(),
  )
}
