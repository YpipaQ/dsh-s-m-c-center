/**
 * The CLI registry document (`S-M-C/cli.json`) and the entry shape it holds.
 *
 * `enabled` here means "公告给 Agent" — advertised in the announcement — not
 * "running". This plugin cannot start or stop a CLI, because the system owns
 * the executable; the flag is the only two-state control it has.
 *
 * The document is hand-editable, so `enabled` is read through a lenient
 * coercion and always written back as a real boolean. That matters: a plain
 * `!== false` check would treat the *string* `"false"` as true and silently
 * promote a hidden CLI into the announcement.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { storeCliPath } from '../../shared/paths.ts'
import type { CliRegistryEntry, NormalizedCliEntry } from '../../shared/protocol/index.ts'

/** Known well-known tool names the plugin watches out of the box. */
export const DEFAULT_REGISTRY: CliRegistryEntry[] = [
  { name: 'gh', command: 'gh', enabled: false },
  { name: 'git', command: 'git', enabled: false },
  { name: 'tencent-news-cli', command: 'tencent-news-cli', enabled: false },
]

/** Coerce a cli-state boolean (JSON boolean or the string "true"/"false"). */
export function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    if (s === 'true' || s === '1') return true
    if (s === 'false' || s === '0') return false
  }
  return undefined
}

/** The store's CLI registry path (kept with the rest of the S-M-C data). */
export function cliConfigPath(): string {
  return storeCliPath()
}

/** Read the persisted registry document (never throws). */
export function readCliConfig(): { entries: CliRegistryEntry[] } {
  const target = cliConfigPath()
  try {
    if (!existsSync(target)) return { entries: [] }
    const raw = readFileSync(target, 'utf8')
    if (!raw || raw.trim() === '') return { entries: [] }
    const data = JSON.parse(raw) as { entries?: unknown }
    return {
      entries: Array.isArray(data.entries)
        ? (data.entries as CliRegistryEntry[]).filter((e) => e && typeof e.name === 'string')
        : [],
    }
  } catch {
    return { entries: [] }
  }
}

/** Persist the registry document (creating the directory when needed). */
export function writeCliConfig(data: { entries: CliRegistryEntry[] }): void {
  const target = cliConfigPath()
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, JSON.stringify(data, null, 2), 'utf8')
}

/** Validate one registry entry; returns an error string, or null when valid. */
export function validateCliEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return 'entry must be an object'
  const e = entry as CliRegistryEntry
  if (typeof e.name !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(e.name)) {
    return 'invalid name (1-64 chars of A-Za-z0-9_.-)'
  }
  if (e.command !== undefined && (typeof e.command !== 'string' || e.command.trim() === '')) {
    return 'command must be a non-empty string'
  }
  return null
}

/**
 * Normalize a registry entry to its persisted shape.
 *
 * The flag is resolved through {@link toBool} so a hand-edited cli.json
 * carrying `"false"`, `"0"` or `0` is read as 隐藏 instead of being silently
 * promoted to 公告. Anything unrecognized (missing, null, garbage) falls back
 * to the default: 隐藏 — a CLI only reaches the agent through the announcement,
 * so opting in has to be deliberate. The value written back is always a real
 * boolean, so read and write agree on the shape and no invalid state can
 * survive a save.
 */
export function normalizeCliEntry(entry: CliRegistryEntry): NormalizedCliEntry {
  const flag = toBool(entry.enabled)
  return {
    name: entry.name,
    command: (typeof entry.command === 'string' && entry.command.trim() !== '') ? entry.command : entry.name,
    enabled: flag === true,
  }
}

/**
 * The registry entries as persisted, seeded with the built-ins when the file
 * is empty or missing.
 *
 * Seeding matters: the list falls back to {@link DEFAULT_REGISTRY} for an empty
 * document, so writing a single-entry document back would make the built-ins
 * vanish from the list. Every mutation therefore starts from the same set the
 * reader would have shown.
 */
export function persistedEntries(): CliRegistryEntry[] {
  const config = readCliConfig()
  return config.entries.length > 0
    ? config.entries
    : DEFAULT_REGISTRY.map((e) => ({ ...e }))
}
