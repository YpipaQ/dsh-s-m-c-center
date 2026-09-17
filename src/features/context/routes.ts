/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * The workspace is resolved in a deliberate order: the live agent's own cwd
 * first (so a panel call from a running conversation lands in *that*
 * conversation's workspace), then the request's `cwd`. When neither is
 * available the request is **refused** — the old fallback walked up from the
 * host process's own directory, which silently filed another workspace's
 * conversations under whatever directory dsh happened to be started in.
 *
 * A toggle applies to the live agent **before** it persists. The order is the
 * point: persisting first means a failed apply leaves a file (and a panel)
 * claiming a skill the agent cannot see. Only a successful apply is written.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import {
  badRequest, bodyText, handle, ok, queryParam, writeJson,
} from '../../shared/http.ts'
import type { ApplyOutcome } from './apply.ts'
import {
  DEFAULT_CONTEXT_ID, commitSelection, planSelection, readContextIndex, readSelection, workspaceOf,
} from './engine.ts'
import type { AgentLike } from './tools.ts'

/** What the context routes need from the host. */
export interface ContextRouteDeps {
  /**
   * Live agent registry, when the host provides one: flipping a switch in the
   * panel applies immediately to a running conversation through it.
   */
  agents?: { get(id: string): AgentLike | undefined }
  /**
   * Apply one live conversation's selection through `./apply.ts`. Resolves
   * with what really happened; the route persists only when `applied` is true.
   */
  applyToAgent?: (agent: AgentLike) => Promise<ApplyOutcome>
}

/** Said by both write-ish routes when nothing tells us which workspace to use. */
const NO_WORKSPACE = 'cwd required：该会话未在运行，无法确定它的工作区'

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

  /**
   * The workspace a session-scoped request is about, or undefined when nothing
   * says. Deliberately never guesses: a guessed workspace writes real files
   * into the wrong directory, which is not recoverable by a later fix.
   */
  const workspaceFor = (sessionId: string, requested: string | undefined): string | undefined => {
    const live = agentCwdOf(sessionId)
    if (live !== undefined && live !== '') return workspaceOf(live)
    if (requested !== undefined && requested !== '') return workspaceOf(requested)
    return undefined
  }

  return [
    // The index also reports the files it skipped, so a stray one is explained
    // instead of being read as a conversation (or as a schema change).
    handle('GET', SMC_API.contexts, async (_req, res, _body, url) => {
      const workspace = workspaceOf(queryParam(url, 'cwd'))
      const { selections, ignored } = readContextIndex(workspace)
      writeJson(res, 200, ok({ workspace, defaultId: DEFAULT_CONTEXT_ID, selections, ignored }))
    }),

    handle('POST', SMC_API.contextsGet, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      if (!sessionId) { badRequest(res, 'sessionId required'); return }
      const workspace = workspaceFor(sessionId, bodyText(body, 'cwd') || undefined)
      if (workspace === undefined) { badRequest(res, NO_WORKSPACE); return }
      writeJson(res, 200, ok({ workspace, selection: readSelection(workspace, sessionId) }))
    }),

    // A panel flip. Two paths, chosen by whether the conversation is running:
    //  - not running: persist, and say so (`applied: false`) — the client's copy
    //    already distinguishes 已即时生效 from 会话未运行，下次启动生效.
    //  - running: apply first, persist only if that worked.
    handle('POST', SMC_API.contextsToggle, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      const slug = bodyText(body, 'slug')
      if (!sessionId || !slug) { badRequest(res, 'sessionId and slug required'); return }
      const workspace = workspaceFor(sessionId, bodyText(body, 'cwd') || undefined)
      if (workspace === undefined) { badRequest(res, NO_WORKSPACE); return }
      const agent = deps.agents?.get(sessionId)
      if (agent === undefined || deps.applyToAgent === undefined) {
        const planned = planSelection(workspace, sessionId, slug)
        commitSelection(workspace, planned)
        writeJson(res, 200, ok({ selection: planned, applied: false }))
        return
      }
      const planned = planSelection(workspace, sessionId, slug)
      const outcome = await deps.applyToAgent(agent)
      if (!outcome.applied) {
        // Nothing was written: report the file's real content, not the intent.
        writeJson(res, 200, ok({
          selection: readSelection(workspace, sessionId),
          applied: false,
          error: outcome.error ?? '',
          missing: outcome.missing,
        }))
        return
      }
      commitSelection(workspace, planned)
      writeJson(res, 200, ok({ selection: planned, applied: true, missing: outcome.missing }))
    }),
  ]
}
