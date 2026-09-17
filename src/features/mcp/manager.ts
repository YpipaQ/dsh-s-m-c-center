/**
 * The live MCP connections.
 *
 * Owns every `@deepseek-ai/dsh-mcp-client` fiber, keyed by server name, and
 * keeps that set *converged* rather than commanded: `sync()` takes the desired
 * list and reconciles what is running against it, so the same call covers
 * startup, a toggle, an edit, and a plugin teardown.
 *
 * A fiber's lifetime *is* the connection — the client reserves its serverName
 * namespace on load and registers `mcp__<server>__<tool>` on connect, so
 * disposing the fiber disconnects and unregisters in one step. That is why
 * every state change here ends in a dispose.
 * @module
 */

import type { Context, Fiber } from '@deepseek-ai/cordis'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import type { McpConnectionStatus, McpServerConfig, McpServerSummary } from '../../shared/protocol/index.ts'
import {
  ARCHIVE_VERSION, mcpConfigPath, mcpArchivePath, normalizeMcpServer, readMcpArchive,
  readMcpConfig, sameShape, toMcpClientConfig, upsert, without, writeMcpArchive, writeMcpConfig,
} from './document.ts'

/** One entry of the live set: the config it was built from, plus its fiber. */
type LiveEntry = { config: McpServerConfig; fiber: Fiber & PromiseLike<Fiber> }

/** What we remember about a server's connection between passes. */
type StatusNote = { status: McpConnectionStatus; error?: string }

/** Message from an unknown thrown value. */
function reasonOf(e: unknown): string {
  return String((e as Error)?.message ?? e)
}

/**
 * Owns every live mcp-client fiber, keyed by server name.
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

/** Re-exported so routes can name both documents without reaching into document.ts. */
export { mcpArchivePath, mcpConfigPath }
