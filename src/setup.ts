/**
 * Plugin identity and the host-facing constants.
 *
 * Kept in one place so the plugin id, its settings key, and the section order
 * it claims are visible together — those three are the values that must not
 * drift, because each one has an on-disk or cross-plugin consequence.
 * @module
 */

import z from 'schemastery'

/** Cordis plugin id. Renaming it breaks existing profiles — treat as fixed. */
export const name = 'dsh-s-m-c-center'

/**
 * Services that must be present before any surface mounts. `settings` is
 * absent on purpose: the config section is attached later through
 * `ctx.inject`, so a host without a settings surface still gets routes + MCP.
 */
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
export const DEFAULT_ENABLED = true
export const DEFAULT_ANNOUNCE = true

/** Where the announcement sits inside the tool-guidance band. */
export const SECTION_ORDER = 160

/**
 * Workspace root for project-scoped discovery in the announcement.
 * Project-level skills live under the cwd, so the same plugin announces a
 * different skill set depending on where dsh is running.
 */
export function workspaceCwd(): string | undefined {
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
 * live state cannot be read. The section normally renders the live
 * announcement instead, which splices in the actual skills, MCP servers and CLI
 * tools — see `src/features/announce/announce.ts` for why that matters.
 */
export const SMC_GUIDANCE = '本机装有 dsh-s-m-c-center 插件（技能/MCP/CLI 管理器，设置页「Web UI 插件 → 工具管理」）。协作规则：1. 新建用户级技能 → 写到 ~/.dsh/S-M-C/skills/<名>/（含 SKILL.md，frontmatter 需 name+description）；禁写 ~/.dsh/skills、~/.agents/skills 等库外目录；写入后为「未启用」，用户启用后可用；项目专用技能放当前项目的 .dsh/skills/。2. 技能加载：仅用 skill 工具加载已启用技能。3. MCP：仅调已连接服务器的 mcp__<server>__<tool>；未连接/归档不可用，需用户激活。4. 本地 CLI（gh/git 及 skill 内嵌 scripts/run-cli 包装的）：经终端按名调用，可报安装/版本/更新/API-Key/子命令状态；「未找到」先装。5. 技能删除＝物理删除不可恢复，先获用户确认。6. 启停/增删归用户在管理页操作。数据在 ~/.dsh/S-M-C（MCP 凭证明文）。提到「技能管理 / 技能导入 / MCP 服务器 / MCP 连接 / CLI 工具 / CLI 状态」即指本插件。'
