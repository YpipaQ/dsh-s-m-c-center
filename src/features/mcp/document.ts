/**
 * The two MCP documents and the definition shape they hold.
 *
 * A definition is *active* while it sits in `mcp.json` and *archived* while it
 * sits in `mcp-archive.json`. `enabled: false` is not a third state — it is the
 * hand-edited spelling of "archived", which `migrateArchive()` folds away at
 * startup so that from then on "not active" has exactly one representation:
 * absent from the active document.
 *
 * Both documents are hand-editable, so every read path treats them as hostile:
 * a missing, blank or corrupt file reads as "no servers" instead of throwing,
 * and every write path re-normalizes the record it is about to persist.
 * @module
 */

import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { storeMcpArchivePath, storeMcpPath } from '../../shared/paths.ts'
import type { McpArchive, McpServerConfig } from '../../shared/protocol/index.ts'

/** Schema version stamped on the archive document. */
export const ARCHIVE_VERSION = 1 as const

/** Server names the client accepts: 1–32 chars of `A-Za-z0-9_-`. */
const NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** Per-call timeout handed to the client. */
const TOOL_CALL_TIMEOUT_MS = 60_000

/** Reconnect policy handed to the client (backoff up to 10 attempts). */
const RECONNECT = { enabled: true, initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 10 }

/** The active document: `$STORE_ROOT/mcp.json`. */
export function mcpConfigPath(): string {
  return storeMcpPath()
}

/**
 * The archive document: `$STORE_ROOT/mcp-archive.json`.
 *
 * The MCP spelling of "not offered" — the same idea as a skill with no link in
 * its root, or a CLI switched to 隐藏. The definition survives untouched, but
 * because it no longer appears in the active document it is neither connected
 * nor announced.
 */
export function mcpArchivePath(): string {
  return storeMcpArchivePath()
}

/**
 * Read a `{ servers: [...] }` document, tolerating anything.
 *
 * The three failure modes that must not throw: the file is absent (first run),
 * it is empty (created but never written), and it is corrupt (hand-edited
 * mid-save). Each collapses to "no servers", which the callers already handle.
 */
function readServers(target: string): McpServerConfig[] {
  try {
    if (!existsSync(target)) return []
    const raw = readFileSync(target, 'utf8')
    if (raw.trim() === '') return []
    const parsed: unknown = JSON.parse(raw)
    const list = (parsed as { servers?: unknown } | null)?.servers
    return Array.isArray(list) ? (list as McpServerConfig[]) : []
  } catch {
    return []
  }
}

/** Write a document as pretty JSON, creating the store directory on demand. */
function writeDocument(target: string, body: unknown): void {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(body, null, 2), 'utf8')
}

/** The active document, as the rest of the plugin knows it. */
export function readMcpConfig(): { servers: McpServerConfig[] } {
  return { servers: readServers(mcpConfigPath()) }
}

/** Persist the active document. */
export function writeMcpConfig(data: { servers: McpServerConfig[] }): void {
  writeDocument(mcpConfigPath(), data)
}

/** The archive document, always carrying the current schema version. */
export function readMcpArchive(): McpArchive {
  return { version: ARCHIVE_VERSION, servers: readServers(mcpArchivePath()) }
}

/** Persist the archive document, stamping the schema version. */
export function writeMcpArchive(data: McpArchive): void {
  writeDocument(mcpArchivePath(), { version: ARCHIVE_VERSION, servers: data.servers })
}

/** True when `value` is a usable `Record<string, string>` (for env/headers). */
function plainRecord(value: unknown): Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, string>
    : {}
}

/** The fields a `stdio` definition persists; anything else is dropped. */
function stdioFields(s: McpServerConfig): Pick<McpServerConfig, 'command' | 'args' | 'env' | 'cwd'> {
  return {
    command: s.command,
    args: Array.isArray(s.args) ? s.args : [],
    env: plainRecord(s.env),
    cwd: s.cwd || '',
  }
}

/** The fields a `streamable-http` definition persists. */
function httpFields(s: McpServerConfig): Pick<McpServerConfig, 'url' | 'headers'> {
  return {
    url: s.url,
    headers: plainRecord(s.headers),
  }
}

/** Non-empty string check shared by the transport-specific rules. */
function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

/** What a transport still needs beyond name + transport. */
const TRANSPORT_REQUIREMENT: Record<McpServerConfig['transport'], { field: 'command' | 'url'; message: string }> = {
  stdio: { field: 'command', message: 'stdio transport requires command' },
  'streamable-http': { field: 'url', message: 'streamable-http transport requires url' },
}

/**
 * Check one definition coming in over the wire.
 * @returns `null` when acceptable, otherwise the reason to show the user.
 */
export function validateMcpServer(server: unknown): string | null {
  if (server === null || typeof server !== 'object' || Array.isArray(server)) return 'server must be an object'
  const candidate = server as Partial<McpServerConfig>
  if (typeof candidate.name !== 'string' || !NAME_PATTERN.test(candidate.name)) {
    return 'invalid name (1-32 chars of A-Za-z0-9_-)'
  }
  const transport = candidate.transport
  if (transport !== 'stdio' && transport !== 'streamable-http') {
    return "transport must be 'stdio' or 'streamable-http'"
  }
  const requirement = TRANSPORT_REQUIREMENT[transport]
  if (!filled(candidate[requirement.field])) return requirement.message
  return null
}

/**
 * Put a definition into the exact shape that gets persisted.
 *
 * Only the fields the transport actually uses survive — a `url` left over from
 * switching a server to stdio would otherwise sit in `mcp.json` forever, and a
 * reused name would silently keep talking to the old endpoint.
 */
export function normalizeMcpServer(server: McpServerConfig): McpServerConfig {
  const base: McpServerConfig = {
    name: server.name,
    transport: server.transport,
    enabled: server.enabled !== false,
  }
  return Object.assign(base, server.transport === 'stdio' ? stdioFields(server) : httpFields(server))
}

/** Translate a persisted definition into the client plugin's config. */
export function toMcpClientConfig(s: McpServerConfig): mcpClient.Config {
  const shared = {
    serverName: s.name,
    toolCallTimeoutMs: TOOL_CALL_TIMEOUT_MS,
    failOnStartupError: true,
    reconnect: RECONNECT,
  }
  return (s.transport === 'stdio'
    ? { ...shared, transport: 'stdio', ...stdioFields(s) }
    : { ...shared, transport: 'streamable-http', ...httpFields(s) }) as mcpClient.Config
}

/**
 * Whether two definitions would produce the same connection.
 *
 * Compared field by field rather than as one JSON blob: key order is not part
 * of the config, so it must not decide a reconnect.
 */
export function sameShape(a: McpServerConfig, b: McpServerConfig): boolean {
  const left: Record<string, unknown> = { ...normalizeMcpServer(a) }
  const right: Record<string, unknown> = { ...normalizeMcpServer(b) }
  const fields = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const field of fields) {
    if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false
  }
  return true
}

/** The same list without `name`. */
export function without(list: McpServerConfig[], name: string): McpServerConfig[] {
  return list.filter((s) => s.name !== name)
}

/** Replace the same-named entry where it sits, or append when it is new. */
export function upsert(list: McpServerConfig[], entry: McpServerConfig): McpServerConfig[] {
  const at = list.findIndex((s) => s.name === entry.name)
  if (at >= 0) list[at] = entry
  else list.push(entry)
  return list
}
