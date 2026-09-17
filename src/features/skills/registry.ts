/**
 * The external-skills registry (`S-M-C/skills-registry.json`) — group 3's
 * ledger, and the home of the announcement flag for native skills.
 *
 * A row here means "this skill exists, keep an eye on it" without moving it:
 * the canonical copy stays wherever the user pointed. Two kinds share the file:
 * `external` rows come from the import flow, `native` rows are written
 * automatically the first time a scan finds a real skill in a scanned root —
 * which is what gives a native skill somewhere to store its 公告 / 隐藏 flag
 * without touching its SKILL.md.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { storeSkillsRegistryPath, storeRoot } from '../../shared/paths.ts'
import type { RegistryEntry, SkillsRegistry } from '../../shared/protocol/index.ts'

/** An empty registry. */
export function emptyRegistry(): SkillsRegistry {
  return { version: 1, entries: [] }
}

/** Read the external-skills registry, tolerating a missing or corrupt file. */
export function readRegistry(): SkillsRegistry {
  const file = storeSkillsRegistryPath()
  if (!existsSync(file)) return emptyRegistry()
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as SkillsRegistry).entries)) {
      throw new Error('malformed registry')
    }
    return parsed as SkillsRegistry
  } catch {
    return emptyRegistry()
  }
}

/** Write the registry atomically. */
export function writeRegistry(reg: SkillsRegistry): void {
  mkdirSync(storeRoot(), { recursive: true })
  const file = storeSkillsRegistryPath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8')
  renameSync(tmp, file)
}

/** Replace (or insert) one registry entry. */
export function upsertRegistryEntry(entry: RegistryEntry): void {
  const reg = readRegistry()
  const idx = reg.entries.findIndex((e) => e.slug === entry.slug)
  if (idx >= 0) reg.entries[idx] = entry
  else reg.entries.push(entry)
  writeRegistry(reg)
}

/** Drop one registry entry by slug. */
export function dropRegistryEntry(slug: string): void {
  const reg = readRegistry()
  reg.entries = reg.entries.filter((e) => e.slug !== slug)
  writeRegistry(reg)
}

/** Registry entry for one slug, when present. */
export function registryEntryOf(slug: string): RegistryEntry | undefined {
  return readRegistry().entries.find((e) => e.slug === slug)
}

/**
 * Registry entry whose canonical path matches `resolved`, when present.
 *
 * Matches the entry's own directory (a bundle's parent for a file row) and
 * anything beneath it, so a link pointing at `bundle/sub` still resolves to the
 * skill that owns `bundle`.
 */
export function registryEntryOfByPath(resolved: string): RegistryEntry | undefined {
  const want = fold(resolve(resolved))
  return readRegistry().entries.find((e) => {
    const base = fold(e.kind === 'file' ? dirname(resolve(e.path)) : resolve(e.path))
    return base === want || want.startsWith(base + fold(sep))
  })
}

/** Fold a path for comparison: case-insensitive on Windows, as-is elsewhere. */
function fold(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p
}
