/**
 * Browser-side client for the `/api/dsh-s-m-c-center` route family.
 *
 * The only data path the tabs use: plain `fetch`, same origin, JSON in and
 * out. Every call funnels through {@link call} so the two failure modes a
 * route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
 * — surface the same way, and a failure never arrives as a silent `undefined`.
 */

import { SMC_API } from '../../shared/protocol/index.ts'
import type {
  CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary,
  ImportItem, ManagerSettings, McpServerConfig, McpServerSummary,
  ScannedSkill, SkillDetail, SkillSummary, StoreOperation,
  StoreStatus, VerifyResult,
} from '../../shared/protocol/index.ts'

/** Raised for any route call that did not come back as `ok`. */
export class SkillsMcpApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillsMcpApiError'
  }
}

/** Turn a response into its payload, or throw the reason it failed. */
async function unwrap<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // A route that dies before our handler runs answers with an HTML error
    // page, so report the status instead of letting the parse error escape.
    throw new SkillsMcpApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  if (response.ok) return body as T
  const reported = (body as { error?: unknown } | null)?.error
  throw new SkillsMcpApiError(typeof reported === 'string' ? reported : `HTTP ${response.status}`)
}

/**
 * One round trip.
 *
 * Routes split into reads (GET, no body) and actions (POST, JSON body); the
 * action routes that take no arguments still send `{}`, so the content-type
 * header always describes what actually went out.
 */
async function call<T>(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<T> {
  const response = await fetch(path, payload === undefined
    ? { method }
    : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  return unwrap<T>(response)
}

/** Append `?cwd=` when a workspace path is known (several routes are scoped). */
function withCwd(path: string, cwd: string | undefined): string {
  return cwd ? `${path}?cwd=${encodeURIComponent(cwd)}` : path
}

/** `?name=…` plus an optional `&cwd=` for the CLI routes. */
function withName(path: string, name: string, cwd: string | undefined): string {
  const query = `?name=${encodeURIComponent(name)}` + (cwd ? `&cwd=${encodeURIComponent(cwd)}` : '')
  return path + query
}

/** The browser half's only data entry point. */
export class SkillsMcpApi {
  // ── skills ───────────────────────────────────────────────────────────────

  async listSkills(cwd: string): Promise<SkillSummary[]> {
    const body = await call<{ items: SkillSummary[] }>('GET', withCwd(SMC_API.skills, cwd))
    return body.items
  }

  async readSkill(path: string): Promise<SkillDetail> {
    const body = await call<{ skill: SkillDetail }>('POST', SMC_API.skillRead, { path })
    return body.skill
  }

  /** Native → stored: canonical copy into the store, link back in place. */
  async migrateSkill(path: string, kind: 'bundle' | 'file', source: SkillSummary['source']): Promise<string> {
    const body = await call<{ slug: string }>('POST', SMC_API.skillMigrate, { path, kind, source })
    return body.slug
  }

  /** Create (or confirm) the `~/.dsh/skills/<slug>` link. */
  async linkSkill(slug: string): Promise<void> {
    await call('POST', SMC_API.skillLink, { slug })
  }

  /** Remove the link (the canonical copy is never touched). */
  async unlinkSkill(slug: string): Promise<void> {
    await call('POST', SMC_API.skillUnlink, { slug })
  }

  /** Verify one link (resolves? target alive? tracked?). */
  async verifyLink(slug: string): Promise<VerifyResult> {
    const body = await call<{ result: VerifyResult }>('POST', SMC_API.skillVerify, { slug })
    return body.result
  }

  /** Delete an untracked link (one the ledger has no record of). */
  async deleteUntrackedLink(path: string): Promise<void> {
    await call('POST', SMC_API.skillDeleteLink, { path })
  }

  async deleteSkill(path: string, kind: 'bundle' | 'file'): Promise<void> {
    await call('POST', SMC_API.skillDelete, { path, kind })
  }

  async scanSkills(dir: string): Promise<ScannedSkill[]> {
    const body = await call<{ items: ScannedSkill[] }>('POST', SMC_API.skillScan, { dir })
    return body.items
  }

  /** Register external skills — the canonical copy stays where it is. */
  async registerSkills(items: ImportItem[]): Promise<Array<{ name: string; ok: boolean; reason?: string }>> {
    const body = await call<{ results: Array<{ name: string; ok: boolean; reason?: string }> }>(
      'POST', SMC_API.skillRegister, { items },
    )
    return body.results
  }

  /** Drop a registry entry (and its link, when one exists). */
  async unregisterSkill(slug: string): Promise<void> {
    await call('POST', SMC_API.skillUnregister, { slug })
  }

  /** Traceability pass: does every registered path still exist? */
  async refreshRegistry(): Promise<Array<{ slug: string; name: string; exists: boolean }>> {
    const body = await call<{ results: Array<{ slug: string; name: string; exists: boolean }> }>(
      'POST', SMC_API.skillRefresh, {},
    )
    return body.results
  }

  // ── conversation contexts ────────────────────────────────────────────────
  //
  // Only the workspace default (`_default`) is wired up: the panel exposes it
  // alone, and a conversation's own selection is the agent's business. The
  // Host still serves `GET SMC_API.contexts` (every selection under a
  // workspace) for anything that wants the whole picture.

  /** One conversation's selection. */
  async getContext(sessionId: string, cwd: string): Promise<{ workspace: string; selection: { sessionId: string; selected: string[]; updatedAt: string } }> {
    return await call('POST', SMC_API.contextsGet, { sessionId, cwd })
  }

  /** Flip one slug in one conversation; applied live when it is running. */
  async toggleContext(sessionId: string, slug: string, cwd: string): Promise<{ selection: { sessionId: string; selected: string[] }; applied: boolean }> {
    return await call('POST', SMC_API.contextsToggle, { sessionId, slug, cwd })
  }

  async storeStatus(): Promise<StoreStatus> {
    const body = await call<{ store: StoreStatus }>('GET', SMC_API.skillStore)
    return body.store
  }

  /** Undo the one-shot migration: every stored skill returns to its origin. */
  async rollbackStore(): Promise<StoreOperation> {
    const body = await call<{ result: StoreOperation }>('POST', SMC_API.skillRollback, {})
    return body.result
  }

  /** Run the one-shot migration again — the undo for {@link rollbackStore}. */
  async reMigrateStore(): Promise<StoreOperation> {
    const body = await call<{ result: StoreOperation }>('POST', SMC_API.skillRemigrate, {})
    return body.result
  }

  // ── mcp ──────────────────────────────────────────────────────────────────

  async listMcp(): Promise<McpServerSummary[]> {
    const body = await call<{ servers: McpServerSummary[] }>('GET', SMC_API.mcp)
    return body.servers
  }

  async saveMcp(server: McpServerConfig): Promise<void> {
    await call('POST', SMC_API.mcpSave, { server })
  }

  /** Activate (true) or archive (false) one definition. */
  async setMcpEnabled(name: string, enabled: boolean): Promise<void> {
    await call('POST', SMC_API.mcpEnabled, { name, enabled })
  }

  async deleteMcp(name: string): Promise<void> {
    await call('POST', SMC_API.mcpDelete, { name })
  }

  /** Restore the whole archive at once; returns how many came back. */
  async restoreAllMcp(): Promise<number> {
    const body = await call<{ restored: number }>('POST', SMC_API.mcpRestoreAll, {})
    return body.restored
  }

  async testMcp(server: McpServerConfig): Promise<{ ok: boolean; error?: string }> {
    const body = await call<{ test: { ok: boolean; error?: string } }>('POST', SMC_API.mcpTest, { server })
    return body.test
  }

  // ── cli ──────────────────────────────────────────────────────────────────

  async listCli(cwd: string): Promise<CliSummary[]> {
    const body = await call<{ items: CliSummary[] }>('GET', withCwd(SMC_API.cli, cwd))
    return body.items
  }

  async cliState(name: string, cwd: string): Promise<CliStateDetail> {
    const body = await call<{ state: CliStateDetail }>('GET', withName(SMC_API.cliState, name, cwd))
    return body.state
  }

  async cliSubcommands(name: string, cwd: string): Promise<CliSubcommands> {
    const body = await call<{ subcommands: CliSubcommands }>('GET', withName(SMC_API.cliSubcommands, name, cwd))
    return body.subcommands
  }

  async saveCli(entry: CliRegistryEntry): Promise<void> {
    await call('POST', SMC_API.cliSave, { entry })
  }

  async setCliEnabled(name: string, enabled: boolean): Promise<void> {
    await call('POST', SMC_API.cliEnabled, { name, enabled })
  }

  async deleteCli(name: string): Promise<void> {
    await call('POST', SMC_API.cliDelete, { name })
  }

  /** Both probe halves in one round trip (state + subcommands). */
  async probeCli(name: string, cwd: string): Promise<{ state: CliStateDetail; subcommands: CliSubcommands }> {
    const body = await call<{ state: CliStateDetail; subcommands: CliSubcommands }>(
      'POST', SMC_API.cliProbe, { name, cwd },
    )
    return { state: body.state, subcommands: body.subcommands }
  }

  // ── settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<ManagerSettings> {
    const body = await call<{ settings: ManagerSettings }>('GET', SMC_API.settings)
    return body.settings
  }

  async saveSettings(settings: Partial<ManagerSettings>): Promise<ManagerSettings> {
    const body = await call<{ settings: ManagerSettings }>('POST', SMC_API.settingsSave, { settings })
    return body.settings
  }
}
