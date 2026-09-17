/**
 * Host half of dsh-s-m-c-center: three engines (skills on the filesystem, MCP
 * over real @deepseek-ai/dsh-mcp-client connections, the local CLI registry),
 * the /api/dsh-s-m-c-center route family the browser half drives, and the
 * system-prompt announcement.
 *
 * This module is the composition root and nothing else. It owns exactly the
 * things that cannot live inside a feature: the live config getter that
 * `sync()` reads, the order in which the one-shot migrations run, and the
 * lifecycle that ties every registered surface to the current config. The
 * actual work — what a skill is, how MCP converges, what the announcement says
 * — lives in `src/features/*`.
 *
 * The browser half contributes a first-class settings PAGE — not a card inside
 * a group; see ./client/index.ts. Nothing here patches dsh: every surface is
 * assembled from published NPM packages.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type { AgentLike } from './features/context/index.ts'
import { CliManager } from './features/cli/index.ts'
import { SkillBindings, applyToAgent, buildSkillSelectTool } from './features/context/index.ts'
import { McpManager } from './features/mcp/index.ts'
import { SkillsManager } from './features/skills/index.ts'
import { migrateStoreRoot } from './features/skills/store-migration.ts'
import { invalidateAnnouncement, renderAnnouncement } from './features/announce/index.ts'
import { migrateSettingsNamespace, readSettings, writeSettings } from './features/settings/index.ts'
import { makeRoutes } from './routes.ts'
import {
  Config, DEFAULT_ANNOUNCE, DEFAULT_ENABLED, SECTION_ORDER, SMC_GUIDANCE, SMC_NAMESPACE,
  workspaceCwd,
} from './setup.ts'
import type { Config as ConfigShape } from './setup.ts'

export { name, inject, Config, SMC_NAMESPACE, SMC_GUIDANCE } from './setup.ts'
export type { Config as ConfigFields } from './setup.ts'

/**
 * The slice of dsh's agent registry this plugin uses.
 *
 * Typed locally rather than imported: `agents` is an optional service, and the
 * structural subset is all the lifecycle wiring below needs.
 */
interface LiveAgents {
  get(id: string): AgentLike | undefined
  list(): AgentLike[]
}

/**
 * Wire this plugin into a host context: adopt any legacy on-disk layout, build
 * the three engines, then register whichever surfaces the current config asks
 * for — and keep them in step with every later config change.
 *
 * @param ctx - host context exposing the webserver / tools / system-prompt services.
 * @param config - the composition entry's config, if any; schema defaults are
 *   already applied by the loader before this runs.
 */
export function apply(ctx: Context, config?: ConfigShape): void {
  // The loader hands the first config in already defaulted; a later settings
  // write replaces it, so keep reading through the getter rather than closing
  // over the original value.
  let current = (): ConfigShape => config ?? {}
  const resolve = (): Required<ConfigShape> => ({
    enabled: current().enabled ?? DEFAULT_ENABLED,
    announceToAgent: current().announceToAgent ?? DEFAULT_ANNOUNCE,
  })

  const skills = new SkillsManager()
  const cli = new CliManager(skills)
  const mcp = new McpManager(ctx)
  // Which skills each conversation currently sees. Held here, not at module
  // scope: a plugin reload must not inherit another mount's registrations.
  const bindings = new SkillBindings()

  // One-shot adoption: the canonical copy of every user-level skill moves into
  // the store, and each root gets a link back. Best effort by design — a
  // failure must never keep the plugin from mounting, and a skill that cannot
  // be moved simply stays where it is, still usable.
  try {
    // The settings block moved with the package name; carry the user's values
    // over before anything reads them.
    migrateSettingsNamespace()
    // Relocate first: the skills migration below has to adopt into the new
    // store root, and migrating into the old path would just double the work
    // (and leave every link pointing at a directory that is about to move).
    migrateStoreRoot(skills)
    skills.migrate()
    // Same idea for MCP: a definition that is not active belongs in the
    // archive, not in the active document with a flag on it.
    mcp.migrateArchive()
    invalidateAnnouncement()
  } catch {
    // The status routes report the state; mounting is more important.
  }

  let disposeSection: (() => void) | undefined
  let disposeRoutes: (() => void) | undefined
  let applyAnnouncement: () => void = () => {}

  /**
   * Bring one conversation in line with its selection file.
   *
   * Wrapped so nothing can escape: `agent/created` is a serial event awaited
   * before the session's first prompt is assembled, and a listener that throws
   * **vetoes the session** — a broken skill selection must never stop a user
   * from opening a conversation.
   *
   * Resolves with `undefined` so it can be returned straight from that
   * listener: the serial dispatch awaits it, which is exactly what puts the
   * selection into the conversation's **first** catalog.
   */
  const ensureSelection = async (agent: AgentLike): Promise<undefined> => {
    try {
      const outcome = await applyToAgent(skills, bindings, agent)
      if (!outcome.applied) {
        console.warn('[dsh-s-m-c-center] 会话技能未生效：' + (outcome.error ?? '原因未知'))
      }
    } catch (error) {
      console.warn('[dsh-s-m-c-center] 会话技能应用失败：', error)
    }
    return undefined
  }

  // Live agents, when the host provides the registry (optional inject: a
  // deployment without it still mounts — panel flips just persist without the
  // live-apply path). Resolved lazily so the routes see it whenever it lands.
  let liveAgents: { get(id: string): AgentLike | undefined } | undefined
  ctx.inject(['agents'], (agentsCtx) => {
    const registry = (agentsCtx as unknown as { agents?: LiveAgents }).agents
    if (registry === undefined) return
    liveAgents = registry
    // Conversations already running when this plugin mounts (a settings reload
    // re-runs `apply`) still need their selection…
    for (const agent of registry.list()) void ensureSelection(agent)
    // …and every later one. This is the only path that makes the default
    // selection real for a *new* conversation: without it the promise
    // "a fresh conversation starts with the default picks" is empty, because
    // the panel and the tool both require a conversation that is already live.
    agentsCtx.on('agent/created', (payload: unknown) => {
      const agent = (payload as { agent?: AgentLike } | null)?.agent
      if (agent === undefined) return undefined
      // Return the promise: the serial dispatch awaits it, so the selection is
      // installed before the conversation's first prompt is assembled.
      return ensureSelection(agent)
    })
    agentsCtx.on('agent/disposed', (payload: unknown) => {
      const agent = (payload as { agent?: AgentLike } | null)?.agent
      if (agent !== undefined) void bindings.release(agent)
    })
  })

  const { routes } = makeRoutes({
    skills,
    mcp,
    cli,
    // Read lazily: the agents registry arrives via the optional inject above.
    get agents() {
      return liveAgents
    },
    applyToAgent: (agent) => applyToAgent(skills, bindings, agent),    readOwnSettings: () => readSettings(),
    writeOwnSettings: (next) => {
      writeSettings(next)
      // Adopt the persisted value as the new source, then refresh the section.
      current = () => ({ enabled: readSettings().enabled, announceToAgent: readSettings().announceToAgent })
      invalidateAnnouncement()
      applyAnnouncement()
      return readSettings()
    },
  })

  // The agent-facing selection tool: the model's sanctioned way to flip a
  // skill for its own conversation (writes the per-conversation JSON and
  // re-applies through its own context; the catalog republishes on its own).
  ctx.tools.register(buildSkillSelectTool(skills, bindings))

  // Register (or drop) the system-prompt announcement to match the source.
  // Split out from `sync` so a settings write can refresh just this surface
  // without tearing down the live routes.
  applyAnnouncement = (): void => {
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    if (!resolve().enabled) return
    if (resolve().announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-s-m-c-center',
        order: SECTION_ORDER,
        // A provider, not a string: the live skills / MCP / CLI inventory is
        // read at each assembly so the agent sees what is on the machine now.
        // Falls back to the static blurb if inventory collection blows up —
        // a failed prompt assembly would take the whole turn down.
        text: () => {
          try {
            return renderAnnouncement({ skills, mcp, cli }, workspaceCwd())
          } catch {
            return SMC_GUIDANCE
          }
        },
      })
    }
  }

  // Bring every registered surface in line with the current config.
  const sync = (): void => {
    const value = resolve()
    if (disposeRoutes !== undefined) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    invalidateAnnouncement()
    applyAnnouncement()
    if (!value.enabled) {
      void mcp.dispose()
      return
    }
    disposeRoutes = ctx.effect(
      () => {
        const disposers = routes.map((route) => ctx.webServer.register(route))
        return () => { for (const dispose of disposers) dispose() }
      },
      'dsh-s-m-c-center: routes',
    )
    // Bring up whatever the persisted document marks as active.
    void mcp.reload()
  }

  // Attach the optional settings section (DSH 0.1.2-alpha.2 API: the old
  // standalone `installSettingsSection` was folded into the provider's
  // `installSection` instance method). `ctx.inject` keeps `settings` optional:
  // a deployment without the settings surface still runs routes + MCP, with
  // the composition entry (`config ?? {}`) as the authoritative config.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SMC_NAMESPACE, Config, config ?? {}, {
      setSource: (source) => {
        current = source
        sync()
      },
      onChange: sync,
    })
  })

  // Connections must not outlive the plugin.
  ctx.effect(() => () => { void mcp.dispose() }, 'dsh-s-m-c-center: mcp')

  // Registrations live on the injection fibers `SkillBindings` holds, so they
  // must be dropped on unload — otherwise the next mount would find the names
  // already taken and its own registrations silently ignored.
  ctx.effect(() => () => { void bindings.releaseAll() }, 'dsh-s-m-c-center: skill bindings')

  sync()
}
