/**
 * The `/mcp` route family.
 *
 * Note the shape every mutating route shares: change the document, then
 * `await mcp.sync(...)`. The sync is not optional — archiving a server has to
 * actually disconnect it, and the two documents are the only source of truth
 * for what should be running.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import {
  badRequest, bodyFlag, bodyText, handle, notFound, ok, writeJson,
} from '../../shared/http.ts'
import type { McpServerConfig } from '../../shared/protocol/index.ts'
import { readMcpArchive, readMcpConfig, validateMcpServer } from './document.ts'
import type { McpManager } from './manager.ts'

/** Build the MCP route table. */
export function mcpRoutes(mcp: McpManager): WebRoute[] {
  /** Every definition name across both documents, for not-found checks. */
  const allKnownNames = (): string[] => [
    ...readMcpConfig().servers.map((s) => s.name),
    ...readMcpArchive().servers.map((s) => s.name),
  ]

  return [
    handle('GET', SMC_API.mcp, async (_req, res) => {
      writeJson(res, 200, ok({ servers: mcp.listForUi() }))
    }),

    handle('POST', SMC_API.mcpSave, async (_req, res, body) => {
      const server = body?.server as McpServerConfig | undefined
      const err = validateMcpServer(server)
      if (err) { badRequest(res, err); return }
      const normalized = mcp.saveServer(server as McpServerConfig)
      await mcp.sync(readMcpConfig().servers)
      writeJson(res, 200, ok({ server: normalized }))
    }),

    // Activating moves the definition back into the active document; archiving
    // moves it out to the archive document. Either way the live fiber set is
    // re-converged, so an archived server is really disconnected.
    handle('POST', SMC_API.mcpEnabled, async (_req, res, body) => {
      const name = bodyText(body, 'name')
      const enabled = bodyFlag(body, 'enabled')
      if (!name) { badRequest(res, 'name required'); return }
      if (!allKnownNames().includes(name)) { notFound(res, 'server not found: ' + name); return }
      if (enabled) mcp.activateServer(name)
      else mcp.archiveServer(name)
      await mcp.sync(readMcpConfig().servers)
      writeJson(res, 200, ok({ name, enabled }))
    }),

    handle('POST', SMC_API.mcpDelete, async (_req, res, body) => {
      const name = bodyText(body, 'name')
      if (!name) { badRequest(res, 'name required'); return }
      if (!allKnownNames().includes(name)) { notFound(res, 'server not found: ' + name); return }
      mcp.deleteServer(name)
      await mcp.sync(readMcpConfig().servers)
      writeJson(res, 200, ok({ name }))
    }),

    // Uninstall page's 归还 for the MCP half: every archived definition goes
    // back into the active document and is re-connected on the next sync.
    handle('POST', SMC_API.mcpRestoreAll, async (_req, res) => {
      const restored = mcp.activateAll()
      await mcp.sync(readMcpConfig().servers)
      writeJson(res, 200, ok({ restored }))
    }),

    handle('POST', SMC_API.mcpTest, async (_req, res, body) => {
      const server = body?.server as McpServerConfig | undefined
      const err = validateMcpServer(server)
      if (err) { badRequest(res, err); return }
      const result = await mcp.testConnect(server as McpServerConfig)
      writeJson(res, 200, ok({ test: result }))
    }),
  ]
}
