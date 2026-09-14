/**
 * Browser-side client for the `/api/dsh-skills-mcp` route family.
 *
 * The only data path the tabs use: plain `fetch`, same origin, JSON in and
 * out. Every call funnels through {@link call} so the two failure modes a
 * route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
 * — surface the same way, and a failure never arrives as a silent `undefined`.
 */

import { SKILLS_MCP_API } from '../protocol.ts'
import type {
  CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary,
  ImportItem, ImportResult, ManagerSettings, McpServerConfig, McpServerSummary,
  ScannedSkill, SkillDetail, SkillSummary, StoreOperation, StoreStatus,
} from '../protocol.ts'

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
    const body = await call<{ items: SkillSummary[] }>('GET', withCwd(SKILLS_MCP_API.skills, cwd))
    return body.items
  }

  async readSkill(path: string): Promise<SkillDetail> {
    const body = await call<{ skill: SkillDetail }>('POST', SKILLS_MCP_API.skillRead, { path })
    return body.skill
  }

  async toggleSkill(path: string, enabled: boolean): Promise<void> {
    await call('POST', SKILLS_MCP_API.skillToggle, { path, enabled })
  }

  async deleteSkill(path: string, kind: 'bundle' | 'file'): Promise<void> {
    await call('POST', SKILLS_MCP_API.skillDelete, { path, kind })
  }

  async scanSkills(dir: string): Promise<ScannedSkill[]> {
    const body = await call<{ items: ScannedSkill[] }>('POST', SKILLS_MCP_API.skillScan, { dir })
    return body.items
  }

  async importSkills(items: ImportItem[]): Promise<ImportResult[]> {
    const body = await call<{ results: ImportResult[] }>('POST', SKILLS_MCP_API.skillImport, { items })
    return body.results
  }

  async storeStatus(): Promise<StoreStatus> {
    const body = await call<{ store: StoreStatus }>('GET', SKILLS_MCP_API.skillStore)
    return body.store
  }

  /** Undo the one-shot migration: every stored skill returns to its origin. */
  async rollbackStore(): Promise<StoreOperation> {
    const body = await call<{ result: StoreOperation }>('POST', SKILLS_MCP_API.skillRollback, {})
    return body.result
  }

  /** Run the one-shot migration again — the undo for {@link rollbackStore}. */
  async reMigrateStore(): Promise<StoreOperation> {
    const body = await call<{ result: StoreOperation }>('POST', SKILLS_MCP_API.skillRemigrate, {})
    return body.result
  }

  // ── mcp ──────────────────────────────────────────────────────────────────

  async listMcp(): Promise<McpServerSummary[]> {
    const body = await call<{ servers: McpServerSummary[] }>('GET', SKILLS_MCP_API.mcp)
    return body.servers
  }

  async saveMcp(server: McpServerConfig): Promise<void> {
    await call('POST', SKILLS_MCP_API.mcpSave, { server })
  }

  /** Activate (true) or archive (false) one definition. */
  async setMcpEnabled(name: string, enabled: boolean): Promise<void> {
    await call('POST', SKILLS_MCP_API.mcpEnabled, { name, enabled })
  }

  async deleteMcp(name: string): Promise<void> {
    await call('POST', SKILLS_MCP_API.mcpDelete, { name })
  }

  /** Restore the whole archive at once; returns how many came back. */
  async restoreAllMcp(): Promise<number> {
    const body = await call<{ restored: number }>('POST', SKILLS_MCP_API.mcpRestoreAll, {})
    return body.restored
  }

  async testMcp(server: McpServerConfig): Promise<{ ok: boolean; error?: string }> {
    const body = await call<{ test: { ok: boolean; error?: string } }>('POST', SKILLS_MCP_API.mcpTest, { server })
    return body.test
  }

  // ── cli ──────────────────────────────────────────────────────────────────

  async listCli(cwd: string): Promise<CliSummary[]> {
    const body = await call<{ items: CliSummary[] }>('GET', withCwd(SKILLS_MCP_API.cli, cwd))
    return body.items
  }

  async cliState(name: string, cwd: string): Promise<CliStateDetail> {
    const body = await call<{ state: CliStateDetail }>('GET', withName(SKILLS_MCP_API.cliState, name, cwd))
    return body.state
  }

  async cliSubcommands(name: string, cwd: string): Promise<CliSubcommands> {
    const body = await call<{ subcommands: CliSubcommands }>('GET', withName(SKILLS_MCP_API.cliSubcommands, name, cwd))
    return body.subcommands
  }

  async saveCli(entry: CliRegistryEntry): Promise<void> {
    await call('POST', SKILLS_MCP_API.cliSave, { entry })
  }

  async setCliEnabled(name: string, enabled: boolean): Promise<void> {
    await call('POST', SKILLS_MCP_API.cliEnabled, { name, enabled })
  }

  async deleteCli(name: string): Promise<void> {
    await call('POST', SKILLS_MCP_API.cliDelete, { name })
  }

  /** Both probe halves in one round trip (state + subcommands). */
  async probeCli(name: string, cwd: string): Promise<{ state: CliStateDetail; subcommands: CliSubcommands }> {
    const body = await call<{ state: CliStateDetail; subcommands: CliSubcommands }>(
      'POST', SKILLS_MCP_API.cliProbe, { name, cwd },
    )
    return { state: body.state, subcommands: body.subcommands }
  }

  // ── settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<ManagerSettings> {
    const body = await call<{ settings: ManagerSettings }>('GET', SKILLS_MCP_API.settings)
    return body.settings
  }

  async saveSettings(settings: Partial<ManagerSettings>): Promise<ManagerSettings> {
    const body = await call<{ settings: ManagerSettings }>('POST', SKILLS_MCP_API.settingsSave, { settings })
    return body.settings
  }
}
