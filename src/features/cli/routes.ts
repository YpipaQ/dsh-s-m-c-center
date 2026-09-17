/**
 * The `/cli` route family.
 *
 * The read routes take their `name` from the query string; the mutations take
 * it from the JSON body. That asymmetry follows the client: `GET /cli?cwd=…`
 * lists, while every per-tool action is a POST carrying its target.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import {
  badRequest, bodyFlag, bodyText, handle, ok, queryParam, writeJson,
} from '../../shared/http.ts'
import type { CliRegistryEntry } from '../../shared/protocol/index.ts'
import type { CliManager } from './manager.ts'
import { validateCliEntry } from './registry.ts'

/** Build the CLI route table. */
export function cliRoutes(cli: CliManager): WebRoute[] {
  return [
    handle('GET', SMC_API.cli, async (_req, res, _body, url) => {
      writeJson(res, 200, ok({ items: cli.list(queryParam(url, 'cwd')) }))
    }),

    handle('GET', SMC_API.cliState, async (_req, res, _body, url) => {
      const name = queryParam(url, 'name') ?? ''
      if (!name) { badRequest(res, 'name required'); return }
      const state = await cli.readState(name, queryParam(url, 'cwd'))
      writeJson(res, 200, ok({ state }))
    }),

    handle('GET', SMC_API.cliSubcommands, async (_req, res, _body, url) => {
      const name = queryParam(url, 'name') ?? ''
      if (!name) { badRequest(res, 'name required'); return }
      const subcommands = await cli.listSubcommands(name, queryParam(url, 'cwd'))
      writeJson(res, 200, ok({ subcommands }))
    }),

    handle('POST', SMC_API.cliSave, async (_req, res, body) => {
      const entry = body?.entry as CliRegistryEntry | undefined
      const err = validateCliEntry(entry)
      if (err) { badRequest(res, err); return }
      const normalized = cli.saveEntry(entry as CliRegistryEntry)
      writeJson(res, 200, ok({ entry: normalized }))
    }),

    handle('POST', SMC_API.cliEnabled, async (_req, res, body) => {
      const name = bodyText(body, 'name')
      if (!name) { badRequest(res, 'name required'); return }
      const enabled = bodyFlag(body, 'enabled')
      cli.setEnabled(name, enabled)
      writeJson(res, 200, ok({ name, enabled }))
    }),

    handle('POST', SMC_API.cliDelete, async (_req, res, body) => {
      const name = bodyText(body, 'name')
      if (!name) { badRequest(res, 'name required'); return }
      cli.removeEntry(name)
      writeJson(res, 200, ok({ name }))
    }),

    // One round trip for both halves of the detail pane: the state block and
    // the subcommand list. The client fetches them together and shows one card,
    // so splitting them into two routes would only add a second spawn.
    handle('POST', SMC_API.cliProbe, async (_req, res, body) => {
      const name = bodyText(body, 'name')
      if (!name) { badRequest(res, 'name required'); return }
      const cwd = typeof body?.cwd === 'string' ? body.cwd : undefined
      const state = await cli.readState(name, cwd)
      const subcommands = await cli.listSubcommands(name, cwd)
      writeJson(res, 200, ok({ state, subcommands }))
    }),
  ]
}
