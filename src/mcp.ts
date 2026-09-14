/**
 * The MCP half of the manager: two JSON documents on disk and the live
 * connections they describe.
 *
 * A definition is *active* while it sits in `mcp.json` and *archived* while it
 * sits in `mcp-archive.json`. Only active definitions are ever connected:
 * every enabled one gets its own `@deepseek-ai/dsh-mcp-client` fiber, and that
 * fiber's lifetime is the connection — disposing it disconnects and unregisters
 * the `mcp__<server>__<tool>` tools in one step. Archiving therefore means
 * "moved out of the active document", never "flagged off in place".
 *
 * Both documents are hand-editable, so every read path treats them as hostile:
 * a missing, blank or corrupt file reads as "no servers" instead of throwing,
 * and every write path re-normalizes the record it is about to persist.
 * @module
 */

import type { Context, Fiber } from '@deepseek-ai/cordis'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { McpArchive, McpConnectionStatus, McpServerConfig, McpServerSummary } from './protocol.ts'
import { storeMcpArchivePath, storeMcpPath } from './store.ts'

/** Schema version stamped on the archive document. */
const ARCHIVE_VERSION = 1 as const

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

// ── document plumbing ──────────────────────────────────────────────────────

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

// ── definition shape ──────────────────────────────────────────────────────

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
function toMcpClientConfig(s: McpServerConfig): mcpClient.Config {
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

/** Whether two definitions would produce the same connection. */
function sameShape(a: McpServerConfig, b: McpServerConfig): boolean {
  // Compare the persisted shapes field by field rather than as one JSON blob:
  // key order is not part of the config, so it must not decide a reconnect.
  const left: Record<string, unknown> = { ...normalizeMcpServer(a) }
  const right: Record<string, unknown> = { ...normalizeMcpServer(b) }
  const fields = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const field of fields) {
    if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false
  }
  return true
}

/** Message from an unknown thrown value. */
function reasonOf(e: unknown): string {
  return String((e as Error)?.message ?? e)
}

// ── small list edits ──────────────────────────────────────────────────────

/** The same list without `name`. */
function without(list: McpServerConfig[], name: string): McpServerConfig[] {
  return list.filter((s) => s.name !== name)
}

/** Replace the same-named entry where it sits, or append when it is new. */
function upsert(list: McpServerConfig[], entry: McpServerConfig): McpServerConfig[] {
  const at = list.findIndex((s) => s.name === entry.name)
  if (at >= 0) list[at] = entry
  else list.push(entry)
  return list
}

// ── live connections ──────────────────────────────────────────────────────

/** One entry of the live set: the config it was built from, plus its fiber. */
type LiveEntry = { config: McpServerConfig; fiber: Fiber & PromiseLike<Fiber> }

/** What we remember about a server's connection between passes. */
type StatusNote = { status: McpConnectionStatus; error?: string }

/**
 * Owns every live mcp-client fiber, keyed by server name.
 *
 * The set is *converged*, not commanded: {@link sync} takes the desired list
 * and reconciles what is running against it, so the same call covers startup,
 * a toggle, an edit, and a plugin teardown.
 */
export class McpManager {
  private readonly live = new Map<string, LiveEntry>()
  private readonly notes = new Map<string, StatusNote>()

  constructor(private readonly ctx: Context) {}

  /** Re-read the active document and converge onto it. */
  async reload(): Promise<void> {
    await this.sync(readMcpConfig().servers)
  }

  /**
   * Make the live set match `servers` (enabled ones only).
   *
   * Two passes, planned before either acts: first everything that is running
   * but no longer wanted — removed, disabled, or edited into a different shape
   * — is torn down; then everything wanted without a fiber is brought up.
   */
  async sync(servers: McpServerConfig[]): Promise<void> {
    const wanted = new Map<string, McpServerConfig>()
    for (const s of servers) {
      if (s.enabled !== false) wanted.set(s.name, s)
    }

    const stale: string[] = []
    for (const [name, entry] of this.live) {
      const target = wanted.get(name)
      if (target === undefined || !sameShape(entry.config, target)) stale.push(name)
    }
    for (const name of stale) await this.drop(name)

    for (const [name, config] of wanted) {
      if (this.live.has(name)) continue
      this.notes.set(name, { status: 'connecting' })
      let fiber: LiveEntry['fiber']
      try {
        // The client reserves its serverName namespace on load, so a name
        // collision surfaces here rather than at the first tool call.
        fiber = this.ctx.plugin(mcpClient, toMcpClientConfig(config))
      } catch (e) {
        this.notes.set(name, { status: 'failed', error: reasonOf(e) })
        continue
      }
      this.live.set(name, { config: normalizeMcpServer(config), fiber })
      void fiber.then(
        () => { this.notes.set(name, { status: 'running' }) },
        (e) => {
          // failOnStartupError means the initial connect rejected; the client
          // has already rolled the fiber back, so drop it and keep the reason.
          this.live.delete(name)
          this.notes.set(name, { status: 'failed', error: reasonOf(e) })
        },
      )
    }
  }

  /** Stop and dispose one connection, if it is running. */
  private async drop(name: string): Promise<void> {
    const entry = this.live.get(name)
    if (entry === undefined) return
    this.live.delete(name)
    this.notes.delete(name)
    try { await entry.fiber.dispose() } catch { /* already rolled back */ }
  }

  /** Tear every connection down (plugin teardown). */
  async dispose(): Promise<void> {
    for (const name of [...this.live.keys()]) await this.drop(name)
  }

  // ── the two documents ───────────────────────────────────────────────────

  /**
   * Fold every `enabled: false` entry out of the active document into the
   * archive. Runs once at startup and is idempotent: after a pass the active
   * document has no disabled entries left to find. A hand-edited `enabled:
   * false` is picked up on the next start by design — "not active" has one
   * spelling now, and it is "absent from mcp.json".
   * @returns how many entries were found disabled.
   */
  migrateArchive(): number {
    const active = readMcpConfig()
    const disabled = active.servers.filter((s) => s.enabled === false)
    if (disabled.length === 0) return 0
    const archive = readMcpArchive()
    const known = new Set(archive.servers.map((s) => s.name))
    for (const s of disabled) {
      // An archive entry that is already there wins: it may be the edited copy.
      if (known.has(s.name)) continue
      archive.servers.push({ ...normalizeMcpServer(s), enabled: false })
    }
    writeMcpArchive(archive)
    writeMcpConfig({ servers: active.servers.filter((s) => s.enabled !== false) })
    return disabled.length
  }

  /** Move one active definition into the archive (the caller then syncs). */
  archiveServer(name: string): void {
    const active = readMcpConfig()
    const found = active.servers.find((s) => s.name === name)
    // Unknown name: leave both documents untouched, including not creating the
    // archive file just to write an empty list into it.
    if (found === undefined) return
    const archive = readMcpArchive()
    archive.servers = without(archive.servers, name)
    archive.servers.push({ ...normalizeMcpServer(found), enabled: false })
    writeMcpArchive(archive)
    writeMcpConfig({ servers: without(active.servers, name) })
  }

  /** Move one archived definition back into the active document. */
  activateServer(name: string): void {
    const archive = readMcpArchive()
    const found = archive.servers.find((s) => s.name === name)
    if (found === undefined) return
    writeMcpArchive({ version: ARCHIVE_VERSION, servers: without(archive.servers, name) })
    const active = readMcpConfig()
    active.servers = without(active.servers, name)
    active.servers.push({ ...normalizeMcpServer(found), enabled: true })
    writeMcpConfig(active)
  }

  /**
   * Restore the whole archive at once — the uninstall page's MCP half.
   *
   * One write per document rather than a loop over {@link activateServer}.
   * There is deliberately no undo: a server put back can be archived again on
   * its own row whenever the user wants.
   * @returns how many definitions were restored.
   */
  activateAll(): number {
    const archive = readMcpArchive()
    if (archive.servers.length === 0) return 0
    const restored = archive.servers.map((s) => ({ ...normalizeMcpServer(s), enabled: true }))
    writeMcpArchive({ version: ARCHIVE_VERSION, servers: [] })
    const active = readMcpConfig()
    const taken = new Set(active.servers.map((s) => s.name))
    for (const s of restored) {
      if (taken.has(s.name)) continue
      taken.add(s.name)
      active.servers.push(s)
    }
    writeMcpConfig(active)
    return restored.length
  }

  /** Drop a definition from whichever document holds it. */
  deleteServer(name: string): void {
    const active = readMcpConfig()
    if (active.servers.some((s) => s.name === name)) {
      writeMcpConfig({ servers: without(active.servers, name) })
    }
    const archive = readMcpArchive()
    if (archive.servers.some((s) => s.name === name)) {
      writeMcpArchive({ version: ARCHIVE_VERSION, servers: without(archive.servers, name) })
    }
  }

  /**
   * Persist a definition as active.
   *
   * Saving is how a row is enabled: an archived entry of the same name is
   * pulled out of the archive, and the active entry keeps its position in the
   * file when it already existed.
   */
  saveServer(server: McpServerConfig): McpServerConfig {
    const definition: McpServerConfig = { ...normalizeMcpServer(server), enabled: true }
    const archive = readMcpArchive()
    if (archive.servers.some((s) => s.name === definition.name)) {
      writeMcpArchive({ version: ARCHIVE_VERSION, servers: without(archive.servers, definition.name) })
    }
    const active = readMcpConfig()
    writeMcpConfig({ servers: upsert(active.servers, definition) })
    return definition
  }

  /**
   * One-shot probe behind the "test connection" button: connect (with
   * failOnStartupError, so a bad server rejects instead of lingering), then
   * always dispose. Already-live servers answer ok immediately — a second
   * fiber would collide on the reserved serverName namespace.
   */
  async testConnect(server: McpServerConfig): Promise<{ ok: boolean; error?: string }> {
    const probe = normalizeMcpServer(server)
    if (this.live.has(probe.name)) return { ok: true }
    const fiber = this.ctx.plugin(mcpClient, toMcpClientConfig(probe))
    try {
      await fiber
      return { ok: true }
    } catch (e) {
      return { ok: false, error: reasonOf(e) }
    } finally {
      try { await fiber.dispose() } catch { /* probe fiber is done either way */ }
    }
  }

  // ── read models ─────────────────────────────────────────────────────────

  /**
   * Persisted definitions merged with live status, for the UI.
   * @param servers - entries from one document.
   * @param archived - true when they came from the archive: such rows are
   *   always reported inactive and stopped, whatever the live set says.
   */
  summarize(servers: McpServerConfig[], archived = false): McpServerSummary[] {
    return servers.map((s) => {
      const note = this.notes.get(s.name)
      const enabled = !archived && s.enabled !== false
      return {
        ...s,
        enabled,
        status: enabled ? (note?.status ?? 'connecting') : 'stopped',
        error: note?.error,
        archived,
      }
    })
  }

  /**
   * Snapshot of the active document plus live status.
   *
   * Safe to call from a prompt renderer: it only re-reads the file and merges
   * in-memory status — it never converges the live set, unlike {@link reload}.
   */
  current(): McpServerSummary[] {
    try {
      return this.summarize(readMcpConfig().servers)
    } catch {
      return []
    }
  }

  /**
   * Active rows first, archived rows after, for the management list.
   *
   * The archived rows have to be there: without them, archiving a server would
   * remove the only row that could switch it back on.
   */
  listForUi(): McpServerSummary[] {
    try {
      return [
        ...this.summarize(readMcpConfig().servers, false),
        ...this.summarize(readMcpArchive().servers, true),
      ]
    } catch {
      return []
    }
  }
}
