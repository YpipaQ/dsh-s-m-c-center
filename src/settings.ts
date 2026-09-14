/**
 * Plugin-settings persistence for the manager's own config namespace
 * (`dsh-s-m-c-center`) inside ~/.dsh/settings.yaml.
 *
 * The official settings surface does not expose third-party namespaces to the
 * browser, so the card's "announce to agent" switch round-trips through a
 * host route that edits the YAML file directly. To avoid re-serializing the
 * whole document (and clobbering sibling plugins' nested structures), the
 * writer performs a surgical top-level-block replacement: only the
 * `dsh-s-m-c-center:` key's block is rewritten, every other line is kept
 * byte-for-byte.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ManagerSettings } from './protocol.ts'

/** The top-level settings key this plugin owns. */
export const SETTINGS_NAMESPACE = 'dsh-s-m-c-center'

/**
 * The key builds before the rename wrote to. Installs from that era still carry
 * the block — {@link migrateSettingsNamespace} moves it over once.
 */
export const LEGACY_SETTINGS_NAMESPACE = 'skills-mcp-manager'

/** Defaults, mirroring the host-side cordis schema in index.ts. */
export const DEFAULT_SETTINGS: ManagerSettings = { enabled: true, announceToAgent: true }

/** Path of the dsh settings document. */
export function settingsPath(): string {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(dshHome, 'settings.yaml')
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

/** Read the plugin's settings, falling back to defaults for anything missing. */
export function readSettings(): ManagerSettings {
  const target = settingsPath()
  if (!existsSync(target)) return { ...DEFAULT_SETTINGS }
  let raw: string
  try { raw = readFileSync(target, 'utf8') } catch { return { ...DEFAULT_SETTINGS } }
  const lines = raw.split(/\r?\n/)
  const block = findBlock(lines, SETTINGS_NAMESPACE)
  if (block === null) return { ...DEFAULT_SETTINGS }
  const body = parseBlockBody(lines.slice(block.start + 1, block.end))
  return {
    enabled: parseBool(body.enabled, DEFAULT_SETTINGS.enabled),
    announceToAgent: parseBool(body.announceToAgent, DEFAULT_SETTINGS.announceToAgent),
  }
}

/** Serialize the settings as a YAML block (2-space indent, `key:` first line). */
function renderBlock(settings: ManagerSettings): string[] {
  return [SETTINGS_NAMESPACE + ':', '  enabled: ' + settings.enabled, '  announceToAgent: ' + settings.announceToAgent]
}

/**
 * Replace (or append) the plugin's top-level block, leaving every other line
 * untouched. Creates the file (and its directory) when missing.
 * @param settings - the complete settings to persist.
 * @returns the path written.
 */
export function writeSettings(settings: ManagerSettings): string {
  const target = settingsPath()
  ensureSettingsDir()
  const normalized: ManagerSettings = {
    enabled: settings.enabled !== false,
    announceToAgent: settings.announceToAgent !== false,
  }
  let lines: string[] = []
  if (existsSync(target)) {
    try { lines = readFileSync(target, 'utf8').split(/\r?\n/) } catch { lines = [] }
  }
  // Drop a single trailing empty line so appends stay tidy.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const block = findBlock(lines, SETTINGS_NAMESPACE)
  const rendered = renderBlock(normalized)
  if (block === null) {
    const next = lines.concat(rendered)
    writeFileSync(target, next.join('\n') + '\n', 'utf8')
    return target
  }
  const next = lines.slice(0, block.start).concat(rendered, lines.slice(block.end))
  writeFileSync(target, next.join('\n') + '\n', 'utf8')
  return target
}

/** Ensure the settings directory exists before a write (defensive). */
export function ensureSettingsDir(): void {
  mkdirSync(dirname(settingsPath()), { recursive: true })
}

/**
 * Rename a legacy settings block to the current key, in place.
 *
 * Only the block's first line changes, so every value the user ever set is
 * carried across untouched; the rest of the document is not even re-serialized.
 * If the current key is already present the stale block is simply dropped —
 * the live one wins.
 *
 * Idempotent: once there is nothing legacy left to find it does nothing.
 *
 * @returns true when the document was rewritten.
 */
export function migrateSettingsNamespace(): boolean {
  const target = settingsPath()
  if (!existsSync(target)) return false
  let lines: string[]
  try { lines = readFileSync(target, 'utf8').split(/\r?\n/) } catch { return false }
  const legacy = findBlock(lines, LEGACY_SETTINGS_NAMESPACE)
  if (legacy === null) return false
  if (findBlock(lines, SETTINGS_NAMESPACE) === null) {
    lines[legacy.start] = SETTINGS_NAMESPACE + ':'
  } else {
    lines.splice(legacy.start, legacy.end - legacy.start)
  }
  writeFileSync(target, lines.join('\n'), 'utf8')
  return true
}
