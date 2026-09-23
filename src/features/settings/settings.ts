/**
 * Plugin-settings persistence — now a JSON document inside the unified store
 * (`$STORE_ROOT/settings.json`), not dsh's `~/.dsh/settings.yaml`.
 *
 * Why the move: dsh 0.1.7 archives `~/.dsh/settings.yaml` to
 * `settings.yaml.imported` on upgrade, and every third-party block in it is
 * gone afterwards — a restart silently reset this plugin to its defaults. The
 * store is the one directory the plugin owns end to end, so the settings live
 * there now, next to the rest of the artefacts, and follow `DSH_STORE_ROOT`
 * like everything else.
 *
 * Migration is one-shot and best effort: when `settings.json` does not exist,
 * {@link migrateSettingsIntoStore} looks for the old `dsh-s-m-c-center:` (or
 * legacy `skills-mcp-manager:`) block first in `~/.dsh/settings.yaml` and then
 * in `settings.yaml.imported`, and carries whatever it finds into the JSON.
 * The host calls it once on mount, before anything reads the settings.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { storeRoot, storeSettingsPath } from '../../shared/paths.ts'
import type { ManagerSettings } from '../../shared/protocol/index.ts'

/** The settings key this plugin owned in dsh's settings.yaml. */
export const SETTINGS_NAMESPACE = 'dsh-s-m-c-center'

/**
 * The key builds before the rename wrote to. Installs from that era still
 * carry the block — {@link migrateSettingsIntoStore} picks it up too.
 */
export const LEGACY_SETTINGS_NAMESPACE = 'skills-mcp-manager'

/** Defaults, mirroring the cordis schema in setup.ts. */
export const DEFAULT_SETTINGS: ManagerSettings = { enabled: true, announceToAgent: true }

/** The dsh home directory (`$DSH_HOME`, falling back to `~/.dsh`). */
function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

/**
 * Candidate documents that may still hold the old block, in priority order:
 * the live settings.yaml (dsh ≤ 0.1.6 keeps using it) first, then the archive
 * dsh 0.1.7 leaves behind.
 */
function legacyCandidates(): string[] {
  return [join(dshHome(), 'settings.yaml'), join(dshHome(), 'settings.yaml.imported')]
}

/**
 * Locate the line range of a top-level block: the `key:` line plus every
 * following line that is blank or indented. Returns null when absent.
 * @param lines - document split into lines.
 * @param key - top-level key to find (matched as `^key:`).
 * @returns `{ start, end }` half-open range, or null.
 */
function findBlock(lines: string[], key: string): { start: number; end: number } | null {
  const head = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (head.test(lines[i])) { start = i; break }
  }
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length) {
    const line = lines[end]
    if (line.trim() === '') { end++; continue }
    if (/^\s/.test(line)) { end++; continue }
    break
  }
  return { start, end }
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === 'true' || v === 'yes' || v === 'on' || v === 1 || v === '1') return true
  if (v === false || v === 'false' || v === 'no' || v === 'off' || v === 0 || v === '0') return false
  return fallback
}

/** Strip one layer of matching quotes from a scalar. */
function unquote(v: string): string {
  const s = v.trim()
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1)
  }
  return s
}

/** Read `key: value` pairs from a block body (one indent level deep only). */
function parseBlockBody(lines: string[]): Record<string, string> {
  const data: Record<string, string> = {}
  for (const line of lines) {
    const m = /^\s+([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line)
    if (m) data[m[1]] = unquote(m[2])
  }
  return data
}

/** Pull the old YAML block's values out of one document, or null. */
function readLegacyBlock(file: string): ManagerSettings | null {
  if (!existsSync(file)) return null
  let raw: string
  try { raw = readFileSync(file, 'utf8') } catch { return null }
  const lines = raw.split(/\r?\n/)
  for (const key of [SETTINGS_NAMESPACE, LEGACY_SETTINGS_NAMESPACE]) {
    const block = findBlock(lines, key)
    if (block === null) continue
    const body = parseBlockBody(lines.slice(block.start + 1, block.end))
    return {
      enabled: parseBool(body.enabled, DEFAULT_SETTINGS.enabled),
      announceToAgent: parseBool(body.announceToAgent, DEFAULT_SETTINGS.announceToAgent),
    }
  }
  return null
}

/** Serialize the settings as pretty JSON (stable field order). */
function renderJson(settings: ManagerSettings): string {
  return JSON.stringify({ enabled: settings.enabled, announceToAgent: settings.announceToAgent }, null, 2) + '\n'
}

/** Normalize both fields to booleans, defaulting anything that is not. */
function normalize(settings: Partial<ManagerSettings>): ManagerSettings {
  return {
    enabled: settings.enabled !== false,
    announceToAgent: settings.announceToAgent !== false,
  }
}

/**
 * Read the plugin's settings from the store document, falling back to the
 * defaults when it is missing or unreadable. Pure and idempotent: a missing
 * file is simply defaulted — the one-shot migration into the store is the
 * host's job on mount ({@link migrateSettingsIntoStore}), not this reader's.
 */
export function readSettings(): ManagerSettings {
  const file = storeSettingsPath()
  if (!existsSync(file)) return { ...DEFAULT_SETTINGS }
  let raw: string
  try { raw = readFileSync(file, 'utf8') } catch { return { ...DEFAULT_SETTINGS } }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      enabled: parsed.enabled === undefined ? DEFAULT_SETTINGS.enabled : parsed.enabled !== false,
      announceToAgent: parsed.announceToAgent === undefined ? DEFAULT_SETTINGS.announceToAgent : parsed.announceToAgent !== false,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Persist the settings as the store's settings.json, creating the store
 * directory when needed.
 * @param settings - the complete settings to persist.
 * @returns the path written.
 */
export function writeSettings(settings: ManagerSettings): string {
  const target = storeSettingsPath()
  mkdirSync(storeRoot(), { recursive: true })
  writeFileSync(target, renderJson(normalize(settings)), 'utf8')
  return target
}

/**
 * One-shot migration: carry the old dsh settings.yaml block into the store.
 *
 * Runs only when the store document does not exist yet, so it can never fight
 * live state. Candidates are tried in priority order (live settings.yaml
 * first, then the 0.1.7 archive); within a document the current namespace
 * wins over the legacy one. When nothing is found the defaults are written,
 * so the store document exists afterwards either way.
 *
 * Idempotent: once settings.json exists this does nothing.
 *
 * @returns true when the store document was written on this call.
 */
export function migrateSettingsIntoStore(): boolean {
  const file = storeSettingsPath()
  if (existsSync(file)) return false
  for (const candidate of legacyCandidates()) {
    const found = readLegacyBlock(candidate)
    if (found !== null) {
      writeSettings(found)
      return true
    }
  }
  writeSettings({ ...DEFAULT_SETTINGS })
  return true
}
