/**
 * The /api/dsh-skills-mcp route family — the browser half's only data path.
 * Skills CRUD, MCP CRUD (plus a one-shot connection test), the local CLI
 * registry, and the plugin's own settings block. Every route sits behind a
 * loopback-only trust fence with browser same-origin markers: these endpoints
 * read and write user files and spawn MCP servers, so a LAN-exposed dsh web
 * deployment must not serve them.
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { CliManager, validateCliEntry } from './cli.ts'
import { McpManager, readMcpArchive, readMcpConfig, validateMcpServer } from './mcp.ts'
import { SkillsManager } from './skills.ts'
import { SKILLS_MCP_API } from './protocol.ts'
import type { CliRegistryEntry, ManagerSettings, McpServerConfig } from './protocol.ts'

/** Requests may not exceed this much JSON (definitions and import lists are small). */
const MAX_BODY_BYTES = 1024 * 1024

/** Socket addresses a browser on this machine presents — and nothing else. */
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Hostnames a same-machine browser may use in its Host header. */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** Parse a Host header into a URL; undefined when it is not one. */
function hostUrl(host: string): URL | undefined {
  try {
    return new URL('http://' + host)
  } catch {
    return undefined
  }
}

/**
 * Whether the request came from a browser on this machine.
 *
 * These routes spawn MCP servers and write user files, so a LAN-exposed dsh
 * must not serve them. Three fences, cheapest first: the socket address (not
 * forgeable by the client), the Host header, and the browser's own
 * same-origin markers, which stop another origin from driving them via fetch.
 */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address === undefined || !LOOPBACK_ADDRESSES.has(address)) return false

  const host = request.headers.host
  if (typeof host !== 'string' || host === '') return false
  const target = hostUrl(host)
  if (target === undefined || !LOOPBACK_HOSTNAMES.has(target.hostname)) return false

  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true // same-origin fetches may omit it
  try {
    return new URL(origin).host === target.host
  } catch {
    return false
  }
}

/** Answer with JSON; no referrer ever travels back to the page. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(JSON.stringify(body))
}

/**
 * Read a JSON object body.
 * @returns the parsed object, or undefined when the body is oversized,
 *   malformed, or not an object — the caller answers 400 for all three.
 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.length
    if (received > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** A query parameter, or undefined when the route got none. */
function queryParam(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) ?? undefined
}

export interface RoutesDeps {
  skills: SkillsManager
  mcp: McpManager
  cli: CliManager
  /** Read the plugin's own persisted settings (~/.dsh/settings.yaml block). */
  readOwnSettings: () => ManagerSettings
  /** Persist new settings, then re-apply surfaces; returns what landed. */
  writeOwnSettings: (next: ManagerSettings) => ManagerSettings
}

/** HTTP methods these routes answer. */
type RouteMethod = 'GET' | 'POST'

/** What a route does once the shared fences have passed. */
type RouteAction = (
  req: IncomingMessage,
  res: ServerResponse,
  body: Record<string, unknown>,
  url: URL,
) => Promise<void>

/** Message from an unknown thrown value. */
function failure(e: unknown): string {
  return String((e as Error)?.message ?? e)
}

/** A string field off a request body; '' when absent or not a string. */
function bodyText(body: Record<string, unknown>, key: string): string {
  const value = body?.[key]
  return typeof value === 'string' ? value : ''
}

/** A boolean field off a request body; true only when it is exactly `true`. */
function bodyFlag(body: Record<string, unknown>, key: string): boolean {
  return body?.[key] === true
}

/**
 * Build every /api/dsh-skills-mcp route (exact paths).
 * @param deps - skills engine, MCP connection manager, and CLI manager.
 * @returns the route registrations.
 */
export function makeRoutes(deps: RoutesDeps): { routes: WebRoute[] } {
  const { skills, mcp, cli, readOwnSettings, writeOwnSettings } = deps

  /** Turn away anything that is not a loopback call using the right method. */
  const guard = (req: IncomingMessage, res: ServerResponse, method: RouteMethod): boolean => {
    const refusal = !isLoopbackRequest(req)
      ? { status: 403, error: 'forbidden: loopback-only' }
      : req.method !== method
        ? { status: 405, error: 'method not allowed' }
        : null
    if (refusal === null) return true
    writeJson(res, refusal.status, { ok: false, error: refusal.error })
    return false
  }

  /** Wrap one handler in the shared fences: loopback, method, JSON body. */
  const handle = (method: RouteMethod, path: string, act: RouteAction): WebRoute => ({
    kind: 'exact',
    path,
    handler: async (req, res) => {
      if (!guard(req, res, method)) return
      let payload: Record<string, unknown> = {}
      if (method === 'POST') {
        const parsed = await readJsonBody(req)
        if (parsed === undefined) {
          writeJson(res, 400, { ok: false, error: 'invalid or oversized JSON body' })
          return
        }
        payload = parsed
      }
      try {
        await act(req, res, payload, new URL(req.url ?? '/', 'http://localhost'))
      } catch (e) {
        writeJson(res, 500, { ok: false, error: failure(e) })
      }
    },
  })

  const ok = (data: Record<string, unknown> = {}): Record<string, unknown> => ({ ok: true, ...data })

  /** Every definition name across both documents, for not-found checks. */
  const allKnownNames = (): string[] => [
    ...readMcpConfig().servers.map((s) => s.name),
    ...readMcpArchive().servers.map((s) => s.name),
  ]

  return {
    routes: [
      // ── skills ───────────────────────────────────────────────────────────
      handle('GET', SKILLS_MCP_API.skills, async (_req, res, _body, url) => {
        writeJson(res, 200, ok({ items: skills.listSkills(queryParam(url, 'cwd')) }))
      }),

      handle('POST', SKILLS_MCP_API.skillRead, async (_req, res, body, _url) => {
        const path = bodyText(body, 'path')
        if (!path) { writeJson(res, 400, { ok: false, error: 'path required' }); return }
        const skill = skills.readSkill(path)
        if (skill === null) { writeJson(res, 404, { ok: false, error: 'not a valid skill file: ' + path }); return }
        writeJson(res, 200, ok({ skill }))
      }),

      handle('POST', SKILLS_MCP_API.skillToggle, async (_req, res, body, _url) => {
        const path = bodyText(body, 'path')
        if (!path) { writeJson(res, 400, { ok: false, error: 'path required' }); return }
        const enabled = bodyFlag(body, 'enabled')
        skills.setSkillEnabled(path, enabled)
        writeJson(res, 200, ok({ path, enabled }))
      }),

      handle('POST', SKILLS_MCP_API.skillDelete, async (_req, res, body, _url) => {
        const path = bodyText(body, 'path')
        if (!path) { writeJson(res, 400, { ok: false, error: 'path required' }); return }
        const kind = body.kind === 'bundle' ? 'bundle' : 'file'
        const removed = skills.deleteSkill(path, kind)
        writeJson(res, 200, ok({ path, removed }))
      }),

      handle('POST', SKILLS_MCP_API.skillScan, async (_req, res, body, _url) => {
        const dir = bodyText(body, 'dir')
        if (!dir) { writeJson(res, 400, { ok: false, error: 'directory is required' }); return }
        writeJson(res, 200, ok({ items: skills.scanSkills(dir) }))
      }),

      handle('GET', SKILLS_MCP_API.skillStore, async (_req, res, _body, _url) => {
        writeJson(res, 200, ok({ store: skills.storeStatus() }))
      }),

      handle('POST', SKILLS_MCP_API.skillRollback, async (_req, res, _body, _url) => {
        writeJson(res, 200, ok({ result: skills.rollbackMigration() }))
      }),

      // Uninstall page's undo: put user-level skills back into the store after
      // a rollback gave them to their original locations.
      handle('POST', SKILLS_MCP_API.skillRemigrate, async (_req, res, _body, _url) => {
        writeJson(res, 200, ok({ result: skills.reMigrate() }))
      }),

      handle('POST', SKILLS_MCP_API.skillImport, async (_req, res, body, _url) => {
        const items = Array.isArray(body?.items) ? body.items as Array<{ sourcePath?: unknown; kind?: unknown }> : []
        if (items.length === 0) { writeJson(res, 400, { ok: false, error: 'nothing selected' }); return }
        const results = skills.importSkills(items.map((it) => ({
          sourcePath: typeof it.sourcePath === 'string' ? it.sourcePath : '',
          kind: it.kind === 'bundle' ? 'bundle' : 'file',
        })))
        writeJson(res, 200, ok({ results }))
      }),

      // ── mcp ──────────────────────────────────────────────────────────────
      handle('GET', SKILLS_MCP_API.mcp, async (_req, res, _body, _url) => {
        writeJson(res, 200, ok({ servers: mcp.listForUi() }))
      }),

      handle('POST', SKILLS_MCP_API.mcpSave, async (_req, res, body, _url) => {
        const server = body?.server as McpServerConfig | undefined
        const err = validateMcpServer(server)
        if (err) { writeJson(res, 400, { ok: false, error: err }); return }
        const normalized = mcp.saveServer(server as McpServerConfig)
        await mcp.sync(readMcpConfig().servers)
        writeJson(res, 200, ok({ server: normalized }))
      }),

      // Activating moves the definition back into ~/.dsh/S-M-C/mcp.json; archiving
      // moves it out to ~/.dsh/S-M-C/mcp-archive.json. Either way the live fiber set
      // is re-converged, so an archived server is really disconnected.
      handle('POST', SKILLS_MCP_API.mcpEnabled, async (_req, res, body, _url) => {
        const name = bodyText(body, 'name')
        const enabled = bodyFlag(body, 'enabled')
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        if (!allKnownNames().includes(name)) {
          writeJson(res, 404, { ok: false, error: 'server not found: ' + name }); return
        }
        if (enabled) mcp.activateServer(name)
        else mcp.archiveServer(name)
        await mcp.sync(readMcpConfig().servers)
        writeJson(res, 200, ok({ name, enabled }))
      }),

      handle('POST', SKILLS_MCP_API.mcpDelete, async (_req, res, body, _url) => {
        const name = bodyText(body, 'name')
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        if (!allKnownNames().includes(name)) {
          writeJson(res, 404, { ok: false, error: 'server not found: ' + name }); return
        }
        mcp.deleteServer(name)
        await mcp.sync(readMcpConfig().servers)
        writeJson(res, 200, ok({ name }))
      }),

      // Uninstall page's 归还 for the MCP half: every archived definition goes
      // back into the active document and is re-connected on the next sync.
      handle('POST', SKILLS_MCP_API.mcpRestoreAll, async (_req, res, _body, _url) => {
        const restored = mcp.activateAll()
        await mcp.sync(readMcpConfig().servers)
        writeJson(res, 200, ok({ restored }))
      }),

      handle('POST', SKILLS_MCP_API.mcpTest, async (_req, res, body, _url) => {
        const server = body?.server as McpServerConfig | undefined
        const err = validateMcpServer(server)
        if (err) { writeJson(res, 400, { ok: false, error: err }); return }
        const result = await mcp.testConnect(server as McpServerConfig)
        writeJson(res, 200, ok({ test: result }))
      }),

      // ── cli ──────────────────────────────────────────────────────────────
      handle('GET', SKILLS_MCP_API.cli, async (_req, res, _body, url) => {
        writeJson(res, 200, ok({ items: cli.list(queryParam(url, 'cwd')) }))
      }),

      handle('GET', SKILLS_MCP_API.cliState, async (_req, res, _body, url) => {
        const name = queryParam(url, 'name') ?? ''
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        const state = await cli.readState(name, queryParam(url, 'cwd'))
        writeJson(res, 200, ok({ state }))
      }),

      handle('GET', SKILLS_MCP_API.cliSubcommands, async (_req, res, _body, url) => {
        const name = queryParam(url, 'name') ?? ''
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        const subcommands = await cli.listSubcommands(name, queryParam(url, 'cwd'))
        writeJson(res, 200, ok({ subcommands }))
      }),

      handle('POST', SKILLS_MCP_API.cliSave, async (_req, res, body, _url) => {
        const entry = body?.entry as CliRegistryEntry | undefined
        const err = validateCliEntry(entry)
        if (err) { writeJson(res, 400, { ok: false, error: err }); return }
        const normalized = cli.saveEntry(entry as CliRegistryEntry)
        writeJson(res, 200, ok({ entry: normalized }))
      }),

      handle('POST', SKILLS_MCP_API.cliEnabled, async (_req, res, body, _url) => {
        const name = bodyText(body, 'name')
        const enabled = bodyFlag(body, 'enabled')
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        cli.setEnabled(name, enabled)
        writeJson(res, 200, ok({ name, enabled }))
      }),

      handle('POST', SKILLS_MCP_API.cliDelete, async (_req, res, body, _url) => {
        const name = bodyText(body, 'name')
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        cli.removeEntry(name)
        writeJson(res, 200, ok({ name }))
      }),

      handle('POST', SKILLS_MCP_API.cliProbe, async (_req, res, body, _url) => {
        const name = bodyText(body, 'name')
        if (!name) { writeJson(res, 400, { ok: false, error: 'name required' }); return }
        const cwd = typeof body?.cwd === 'string' ? body.cwd : undefined
        const state = await cli.readState(name, cwd)
        const subcommands = await cli.listSubcommands(name, cwd)
        writeJson(res, 200, ok({ state, subcommands }))
      }),

      // ── settings ─────────────────────────────────────────────────────────
      handle('GET', SKILLS_MCP_API.settings, async (_req, res, _body, _url) => {
        writeJson(res, 200, ok({ settings: readOwnSettings() }))
      }),

      handle('POST', SKILLS_MCP_API.settingsSave, async (_req, res, body, _url) => {
        const raw = body?.settings
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
          writeJson(res, 400, { ok: false, error: 'settings object required' }); return
        }
        const incoming = raw as Record<string, unknown>
        const current = readOwnSettings()
        const next: ManagerSettings = {
          enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : current.enabled,
          announceToAgent: typeof incoming.announceToAgent === 'boolean' ? incoming.announceToAgent : current.announceToAgent,
        }
        const applied = writeOwnSettings(next)
        writeJson(res, 200, ok({ settings: applied }))
      }),
    ],
  }
}
