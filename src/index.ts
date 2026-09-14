/**
 * Host half of dsh-s-m-c-center: three engines (skills on the
 * filesystem, MCP over real @deepseek-ai/dsh-mcp-client connections, the local
 * CLI registry), the /api/dsh-s-m-c-center route family the browser half drives,
 * and the system-prompt announcement.
 *
 * The browser half contributes a first-class settings PAGE — not a card inside
 * a group; see ./client/index.ts. Nothing here patches dsh: every surface is
 * assembled from published NPM packages.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { invalidateAnnouncement, renderAnnouncement } from './announce.ts'
import { CliManager } from './cli.ts'
import { migrateStoreRoot } from './migrate.ts'
import { McpManager } from './mcp.ts'
import { makeRoutes } from './routes.ts'
import { SkillsManager } from './skills.ts'
import { migrateSettingsNamespace, readSettings, writeSettings } from './settings.ts'

/** Cordis plugin id. Renaming it breaks existing profiles — treat as fixed. */
export const name = 'dsh-s-m-c-center'

/** Services that must be present before any surface mounts. `settings` is
 * absent on purpose: the config section is attached later through
 * `ctx.inject`, so a host without a settings surface still gets routes + MCP. */
export const inject = ['webServer', 'tools', 'systemPrompt']

/**
 * Key of this plugin's block in `~/.dsh/settings.yaml`.
 *
 * Written as a literal rather than imported so the browser half can spell the
 * same value without depending on a Host package. It stays a plain kebab-case
 * string because the `settingsNamespace()` branding helper was dropped from
 * `@deepseek-ai/dsh-settings` in DSH 0.1.2-alpha.2.
 */
export const SMC_NAMESPACE = 'dsh-s-m-c-center'

/** Fields a user may put in that block. */
export interface Config {
  /** Master switch: routes, MCP connections and the prompt section. */
  enabled?: boolean
  /** Whether to announce the plugin in every agent's system prompt. */
  announceToAgent?: boolean
}

/** Schema form of the above, so dsh validates the block as it loads it. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
})

/** Fallbacks used until a config block has been written. */
const DEFAULT_ENABLED = true
const DEFAULT_ANNOUNCE = true

/** Where the announcement sits inside the tool-guidance band. */
const SECTION_ORDER = 160

/**
 * Workspace root for project-scoped discovery in the announcement.
 * Project-level skills live under the cwd, so the same plugin announces a
 * different skill set depending on where dsh is running.
 */
function workspaceCwd(): string | undefined {
  try {
    return process.cwd()
  } catch {
    return undefined
  }
}

/**
 * Model-facing announcement: plugin presence, capabilities, and limits.
 *
 * Kept as the static form of the announcement and used as the fallback when the
 * live state cannot be read. The section normally renders
 * {@link renderAnnouncement} instead, which splices in the actual skills, MCP
 * servers and CLI tools — see `src/announce.ts` for why that matters.
 */
export const SMC_GUIDANCE = '本机已安装 dsh-s-m-c-center 插件（工具管理：技能 / MCP / CLI 管理器）：设置页「Web UI 插件 → 工具管理」。能力：浏览/启用/不启用/删除/导入技能（项目级 .dsh/skills、.agents/skills 与用户级 ~/.dsh/skills、~/.agents/skills）；管理 MCP 服务器（stdio 与 streamable-http，激活/归档）；以及本地 CLI 工具清单与状态（发现 skill 内嵌的 CLI 包装脚本如 scripts/run-cli、以及系统 CLI 如 gh/git/tencent-news-cli，报告是否安装/版本/需更新/子命令/API-Key 状态）。MCP 是真实连接：激活的服务器经 @deepseek-ai/dsh-mcp-client 真正连接并把工具注册为 mcp__<server>__<tool>，激活/归档会实际连接/断开。限制：本插件的数据统一存 ~/.dsh/S-M-C（MCP 激活 mcp.json、归档 mcp-archive.json、CLI 注册表 cli.json；密码/env 明文、权限 0600 由用户自行保证）；用户级技能正本在 ~/.dsh/S-M-C/skills，启用/不启用等于在 skills 目录增删联接（不改写 SKILL.md）；删除为物理删除，不可恢复。用户提到「技能管理 / 技能导入 / MCP 服务器 / MCP 连接 / CLI 工具 / CLI 状态」时即指本插件，请据此协作。'

/**
 * Wire this plugin into a host context: adopt any legacy on-disk layout, build
 * the three engines, then register whichever surfaces the current config asks
 * for — and keep them in step with every later config change.
 *
 * @param ctx - host context exposing the webserver / tools / system-prompt services.
 * @param config - the composition entry's config, if any; schema defaults are
 *   already applied by the loader before this runs.
 */
export function apply(ctx: Context, config?: Config): void {
  // The loader hands the first config in already defaulted; a later settings
  // write replaces it, so keep reading through the getter rather than closing
  // over the original value.
  let current = (): Config => config ?? {}
  const resolve = (): Config => ({
    enabled: current().enabled ?? DEFAULT_ENABLED,
    announceToAgent: current().announceToAgent ?? DEFAULT_ANNOUNCE,
  })

  const skills = new SkillsManager()
  const cli = new CliManager(skills)
  const mcp = new McpManager(ctx)

  // One-shot adoption: the canonical copy of every user-level skill moves into
  // the store, and each root gets a link back. Best effort by design — a
  // failure must never keep the plugin from mounting, and a skill that cannot
  // be moved simply stays where it is, still usable and still toggled through
  // its own frontmatter.
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

  // Settings routes edit the owned YAML block, then re-apply the announcement
  // so an announceToAgent flip takes effect immediately (register/drop the
  // system-prompt section) without a dsh restart. Routes are deliberately NOT
  // re-registered here: this runs inside a live request handler, and disposing
  // the in-flight route would truncate the response.
  const { routes } = makeRoutes({
    skills,
    mcp,
    cli,
    readOwnSettings: () => readSettings(),
    writeOwnSettings: (next) => {
      writeSettings(next)
      // Adopt the persisted value as the new source, then refresh the section.
      current = () => ({ enabled: readSettings().enabled, announceToAgent: readSettings().announceToAgent })
      invalidateAnnouncement()
      applyAnnouncement()
      return readSettings()
    },
  })

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

  sync()
}
