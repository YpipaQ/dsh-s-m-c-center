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
import { applyToAgent, buildSkillSelectTool } from './context-tools.ts'
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
export const SMC_GUIDANCE = '本机装有 dsh-s-m-c-center 插件（技能/MCP/CLI 管理器，设置页「Web UI 插件 → 工具管理」）。协作规则：1. 新建用户级技能 → 写到 ~/.dsh/S-M-C/skills/<名>/（含 SKILL.md，frontmatter 需 name+description）；禁写 ~/.dsh/skills、~/.agents/skills 等库外目录；写入后为「未启用」，用户启用后可用；项目专用技能放当前项目的 .dsh/skills/。2. 技能加载：仅用 skill 工具加载已启用技能。3. MCP：仅调已连接服务器的 mcp__<server>__<tool>；未连接/归档不可用，需用户激活。4. 本地 CLI（gh/git 及 skill 内嵌 scripts/run-cli 包装的）：经终端按名调用，可报安装/版本/更新/API-Key/子命令状态；「未找到」先装。5. 技能删除＝物理删除不可恢复，先获用户确认。6. 启停/增删归用户在管理页操作。数据在 ~/.dsh/S-M-C（MCP 凭证明文）。提到「技能管理 / 技能导入 / MCP 服务器 / MCP 连接 / CLI 工具 / CLI 状态」即指本插件。'

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
    // Live agents, when the host provides the registry: a panel flip applies
    // immediately to a running conversation through it. Typed loosely on
    // purpose — the agent registry ships with dsh, not with this package.
    agents: (ctx as unknown as {
      agents?: { get(id: string): { id: string; ctx: unknown; session?: { header?: { cwd?: string } } } | undefined }
    }).agents,
    applyToAgent: (agent) => { applyToAgent(skills, agent as Parameters<typeof applyToAgent>[1]) },
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

  // The agent-facing selection tool: the model's sanctioned way to flip a
  // skill for its own conversation (writes the per-conversation JSON and
  // re-applies through its own context; the catalog republishes on its own).
  ctx.tools.register(buildSkillSelectTool(skills))

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
