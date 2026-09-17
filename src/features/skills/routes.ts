/**
 * The `/skills` route family.
 *
 * Every handler here is thin: validate the body, call one manager method,
 * answer. The fences (loopback, method, JSON body, 500) come from
 * `handle()` in the shared http layer, so what is left is the actual contract —
 * which field is required and which shape comes back.
 * @module
 */

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import {
  badRequest, bodyText, handle, notFound, ok, queryParam, writeJson,
} from '../../shared/http.ts'
import type { SkillSource } from '../../shared/protocol/index.ts'
import type { SkillsManager } from './manager.ts'

/** The four roots a client may send when adopting a skill. */
const SOURCES = ['project-dsh', 'project-agents', 'user-dsh', 'user-agents'] as const

/** Narrow an untrusted body field to a known root name. */
function asSource(value: string): SkillSource {
  return (SOURCES as readonly string[]).includes(value) ? value as SkillSource : 'user-dsh'
}

/** Build the skills route table. */
export function skillsRoutes(skills: SkillsManager): WebRoute[] {
  return [
    handle('GET', SMC_API.skills, async (_req, res, _body, url) => {
      writeJson(res, 200, ok({ items: skills.listSkills(queryParam(url, 'cwd')) }))
    }),

    handle('POST', SMC_API.skillRead, async (_req, res, body) => {
      const path = bodyText(body, 'path')
      if (!path) { badRequest(res, 'path required'); return }
      const skill = skills.readSkill(path)
      if (skill === null) { notFound(res, 'not a valid skill file: ' + path); return }
      writeJson(res, 200, ok({ skill }))
    }),

    handle('POST', SMC_API.skillDelete, async (_req, res, body) => {
      const path = bodyText(body, 'path')
      if (!path) { badRequest(res, 'path required'); return }
      const kind = body.kind === 'bundle' ? 'bundle' : 'file'
      const removed = skills.deleteSkill(path, kind)
      writeJson(res, 200, ok({ path, removed }))
    }),

    // Native → stored: canonical copy into the store, link back in place.
    handle('POST', SMC_API.skillMigrate, async (_req, res, body) => {
      const path = bodyText(body, 'path')
      if (!path) { badRequest(res, 'path required'); return }
      const kind = body.kind === 'bundle' ? 'bundle' : 'file'
      const slug = skills.migrateToStore(path, kind, asSource(bodyText(body, 'source')))
      writeJson(res, 200, ok({ slug }))
    }),

    // Undo a migration: link + ledger + manifest entry all go, the copy
    // returns to its origin.
    handle('POST', SMC_API.skillUnmigrate, async (_req, res, body) => {
      const slug = bodyText(body, 'slug')
      if (!slug) { badRequest(res, 'slug required'); return }
      const restored = skills.unmigrate(slug)
      writeJson(res, 200, ok({ slug, restored }))
    }),

    // Create (or confirm) the link for a stored/registered skill.
    handle('POST', SMC_API.skillLink, async (_req, res, body) => {
      const slug = bodyText(body, 'slug')
      if (!slug) { badRequest(res, 'slug required'); return }
      skills.linkSkill(slug)
      writeJson(res, 200, ok({ slug, linked: true }))
    }),

    handle('POST', SMC_API.skillUnlink, async (_req, res, body) => {
      const slug = bodyText(body, 'slug')
      if (!slug) { badRequest(res, 'slug required'); return }
      skills.unlinkSkill(slug)
      writeJson(res, 200, ok({ slug, linked: false }))
    }),

    handle('POST', SMC_API.skillVerify, async (_req, res, body) => {
      const slug = bodyText(body, 'slug')
      if (!slug) { badRequest(res, 'slug required'); return }
      writeJson(res, 200, ok({ result: skills.verifyLink(slug) }))
    }),

    // Delete a link the ledger has no record of (red-flagged row action).
    handle('POST', SMC_API.skillDeleteLink, async (_req, res, body) => {
      const path = bodyText(body, 'path')
      if (!path) { badRequest(res, 'path required'); return }
      skills.deleteUntrackedLink(path)
      writeJson(res, 200, ok({ path }))
    }),

    handle('POST', SMC_API.skillScan, async (_req, res, body) => {
      const dir = bodyText(body, 'dir')
      if (!dir) { badRequest(res, 'directory is required'); return }
      writeJson(res, 200, ok({ items: skills.scanSkills(dir) }))
    }),

    // Register external skills: the canonical copy stays where it is, only
    // a record goes into skills-registry.json.
    handle('POST', SMC_API.skillRegister, async (_req, res, body) => {
      const items = Array.isArray(body?.items) ? body.items as Array<{ sourcePath?: unknown; kind?: unknown }> : []
      if (items.length === 0) { badRequest(res, 'nothing selected'); return }
      const results = skills.registerExternal(items.map((it) => ({
        sourcePath: typeof it.sourcePath === 'string' ? it.sourcePath : '',
        kind: it.kind === 'bundle' ? 'bundle' : 'file',
      })))
      writeJson(res, 200, ok({ results }))
    }),

    handle('POST', SMC_API.skillUnregister, async (_req, res, body) => {
      const slug = bodyText(body, 'slug')
      if (!slug) { badRequest(res, 'slug required'); return }
      skills.unregisterExternal(slug)
      writeJson(res, 200, ok({ slug }))
    }),

    // Traceability pass: does every registered canonical path still exist?
    handle('POST', SMC_API.skillRefresh, async (_req, res) => {
      writeJson(res, 200, ok({ results: skills.refreshRegistry() }))
    }),

    handle('GET', SMC_API.skillStore, async (_req, res) => {
      writeJson(res, 200, ok({ store: skills.storeStatus() }))
    }),

    handle('POST', SMC_API.skillRollback, async (_req, res) => {
      writeJson(res, 200, ok({ result: skills.rollbackMigration() }))
    }),

    // Uninstall page's undo: put user-level skills back into the store after
    // a rollback gave them to their original locations.
    handle('POST', SMC_API.skillRemigrate, async (_req, res) => {
      writeJson(res, 200, ok({ result: skills.reMigrate() }))
    }),
  ]
}
