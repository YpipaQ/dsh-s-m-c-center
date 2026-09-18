/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * Selections live in one **relay table** (`$STORE_ROOT/contexts.json`, see
 * `./table.ts`), keyed by session id. Nothing here resolves a workspace any
 * more, and that removed two failures at once:
 *
 * - the `cwd required` 400, which fired for every request about a conversation
 *   that was not currently running — nothing could say which workspace it
 *   belonged to, so the panel refused to act;
 * - the settings page and the sidebar reading *two different files* (the page
 *   resolved the workspace dsh reports, the sidebar the one the conversation
 *   runs in), which is how one switch could show two answers.
 *
 * A toggle applies to the live agent **before** it persists. The order is the
 * point: persisting first means a failed apply leaves a row (and a panel)
 * claiming a skill the agent cannot see. Only a successful apply is written.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import { badRequest, bodyText, handle, ok, writeJson } from '../../shared/http.ts'
import type { SkillsManager } from '../skills/index.ts'
import type { ApplyOutcome } from './apply.ts'
import type { ContextSelection } from './engine.ts'
import {
  DEFAULT_CONTEXT_ID, commitSelection, contextTablePath, planSelection, readContextIndex,
  readSelection, resetSelection,
} from './engine.ts'
import type { AgentLike } from './tools.ts'
import { missingSlugs, withoutMissing } from './tools.ts'

/** What the context routes need from the host. */
export interface ContextRouteDeps {
  /** Resolves a selected slug, so a persist-only write never records a ghost. */
  skills: SkillsManager
  /**
   * Live agent registry, when the host provides one: flipping a switch in the
   * panel applies immediately to a running conversation through it.
   */
  agents?: { get(id: string): AgentLike | undefined }
  /**
   * Apply one live conversation's selection through `./apply.ts`. The route
   * hands over the selection it just planned — reading the table here instead
   * applied one flip behind. Resolves with what really happened; the route
   * persists only when `applied` is true.
   */
  applyToAgent?: (agent: AgentLike, selection: ContextSelection) => Promise<ApplyOutcome>
}

/** Build the contexts route table. */
export function contextRoutes(deps: ContextRouteDeps): WebRoute[] {
  return [
    // The index also reports rows it skipped, so a stray one is explained
    // instead of being read as a conversation (or as a schema change).
    handle('GET', SMC_API.contexts, async (_req, res) => {
      const { selections, ignored } = readContextIndex()
      writeJson(res, 200, ok({
        table: contextTablePath(), defaultId: DEFAULT_CONTEXT_ID, selections, ignored,
      }))
    }),

    handle('POST', SMC_API.contextsGet, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      if (!sessionId) { badRequest(res, 'sessionId required'); return }
      writeJson(res, 200, ok({
        table: contextTablePath(), selection: readSelection(sessionId),
      }))
    }),

    // Drop the conversation's row, so it follows the default again. The escape
    // hatch for a conversation that pinned a default it can no longer turn off.
    handle('POST', SMC_API.contextsReset, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      if (!sessionId) { badRequest(res, 'sessionId required'); return }
      const selection = resetSelection(sessionId)
      const agent = deps.agents?.get(sessionId)
      if (agent === undefined || deps.applyToAgent === undefined) {
        writeJson(res, 200, ok({ table: contextTablePath(), selection, applied: false, missing: [] }))
        return
      }
      const outcome = await deps.applyToAgent(agent, selection)
      writeJson(res, 200, ok({
        table: contextTablePath(),
        selection,
        applied: outcome.applied,
        missing: outcome.missing,
        error: outcome.error ?? '',
      }))
    }),

    // A panel flip. Two paths, chosen by whether the conversation is running:
    //  - not running: persist, and say so (`applied: false`) — the client's copy
    //    already distinguishes 已即时生效 from 会话未运行，下次启动生效.
    //  - running: apply first, persist only if that worked.
    handle('POST', SMC_API.contextsToggle, async (_req, res, body) => {
      const sessionId = bodyText(body, 'sessionId')
      const slug = bodyText(body, 'slug')
      if (!sessionId || !slug) { badRequest(res, 'sessionId and slug required'); return }
      const agent = deps.agents?.get(sessionId)
      if (agent === undefined || deps.applyToAgent === undefined) {
        // Nothing to apply to: persist the intent for the next start, but keep
        // the ghost slugs out of the table (the client only learns from the
        // response that they were dropped).
        const planned = planSelection(sessionId, slug)
        const missing = missingSlugs(deps.skills, planned)
        const keep = withoutMissing(planned, missing)
        commitSelection(keep)
        writeJson(res, 200, ok({ table: contextTablePath(), selection: keep, applied: false, missing }))
        return
      }
      const planned = planSelection(sessionId, slug)
      // Hand over the selection we just planned: the table still holds the old
      // one, so letting `applyToAgent` read it applied the *previous* set and
      // answered `applied: true` from the idempotent short-circuit.
      const outcome = await deps.applyToAgent(agent, planned)
      if (!outcome.applied) {
        // Nothing was written: report the table's real content, not the intent.
        writeJson(res, 200, ok({
          table: contextTablePath(),
          selection: readSelection(sessionId),
          applied: false,
          error: outcome.error ?? '',
          missing: outcome.missing,
        }))
        return
      }
      const keep = withoutMissing(planned, outcome.missing)
      commitSelection(keep)
      writeJson(res, 200, ok({
        table: contextTablePath(), selection: keep, applied: true, missing: outcome.missing,
      }))
    }),
  ]
}
