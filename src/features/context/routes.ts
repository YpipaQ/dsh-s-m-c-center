/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * The workspace is resolved in a deliberate order: the live agent's own cwd
 * first (so a panel call from a running conversation lands in *that*
 * conversation's workspace even without an explicit cwd), then the request's
 * `cwd`, then the project root above it.
 *
 * A toggle also re-applies to the live agent when one is registered. That is
 * why the failure of the apply is reported alongside a 200: the selection did
 * persist, and the user needs to know the running conversation did not pick it
 * up.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import {
  badRequest, bodyText, failure, handle, ok, queryParam, writeJson,
} from '../../shared/http.ts'
import {
  DEFAULT_CONTEXT_ID, listSelections, readSelection, toggleSelection, workspaceOf,
} from './engine.ts'
import type { AgentLike } from './tools.ts'

/** What the context routes need from the host. */
export interface ContextRouteDeps {
  /**
   * Live agent registry, when the host provides one: flipping a switch in the
   * panel applies immediately to a running conversation through it.
   */
  agents?: { get(id: string): AgentLike | undefined }
  /** Applied after a panel toggle for a live conversation. */
  applyToAgent?: (agent: AgentLike) => void
}

/** Build the contexts route table. */
export function contextRoutes(deps: ContextRouteDeps): WebRoute[] {
  /**
   * The workspace cwd of a live conversation, when the host provides the agent
   * registry: context files live under the conversation's own workspace, so a
   * panel call without an explicit cwd still lands in the right directory for
   * any conversation that is (or was recently) running.
   */
  const agentCwdOf = (sessionId: string): string | undefined =>
    deps.agents?.get(sessionId)?.session?.header?.cwd

  return [
    handle('GET', SMC_API.contexts, async (_req, res, _body, url) => {
      const workspace = workspaceOf(queryParam(url, 'cwd'))
      writeJson(res, 200, ok({ workspace, defaultId: DEFAULT_CONTEXT_ID, selections: listSelections(workspace) }))
    }),

    handle('POST', SMC_API.contextsGet, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      if (!sessionId) { badRequest(res, 'sessionId required'); return }
      const workspace = workspaceOf(agentCwdOf(sessionId) ?? (bodyText(body, 'cwd') || undefined))
      writeJson(res, 200, ok({ workspace, selection: readSelection(workspace, sessionId) }))
    }),

    // A panel flip: persist the toggle; a running conversation picks the
    // change up immediately through its agent context.
    handle('POST', SMC_API.contextsToggle, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      const slug = bodyText(body, 'slug')
      if (!sessionId || !slug) { badRequest(res, 'sessionId and slug required'); return }
      const workspace = workspaceOf(agentCwdOf(sessionId) ?? (bodyText(body, 'cwd') || undefined))
      const selection = toggleSelection(workspace, sessionId, slug)
      const agent = deps.agents?.get(sessionId)
      if (agent !== undefined && deps.applyToAgent !== undefined) {
        try { deps.applyToAgent(agent) } catch (e) {
          writeJson(res, 200, ok({ selection, applied: false, error: failure(e) }))
          return
        }
      }
      writeJson(res, 200, ok({ selection, applied: agent !== undefined }))
    }),
  ]
}
