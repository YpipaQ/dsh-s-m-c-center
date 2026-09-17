/**
 * Model-facing announcement.
 *
 * The announcement tells the agent that this plugin exists and — importantly —
 * what is actually on the machine right now. A static blurb cannot do that, so
 * the section text is a provider: it is re-evaluated at every prompt assembly
 * and the live skills / MCP servers / CLI tools are spliced in.
 *
 * Motivation (see the CLI case in particular): skills are announced natively by
 * dsh (`<available_skills>` + the `skill` tool) and MCP tools land in the
 * tool list as `mcp__<server>__<tool>`, so neither needs this section. Local
 * CLI tools are registered nowhere — without listing them here the agent has
 * no way to learn that `gh`, `git` or a skill-wrapped CLI exists at all.
 *
 * Every section of the renderer is defensive: a prompt assembly must never fail
 * (or hang) because a directory walk threw, so each block degrades to a short
 * placeholder on error.
 * @module
 */

import type { CliManager } from '../cli/index.ts'
import type { McpManager } from '../mcp/index.ts'
import type { SkillsManager } from '../skills/index.ts'
import type { CliSummary, McpServerSummary, SkillSummary } from '../../shared/protocol/index.ts'

/** Static framing: what the plugin is, and that what follows binds the agent. */
const INTRO = '本机装有 dsh-s-m-c-center 插件（技能/MCP/CLI 管理器）。资源清单如下；协作规则见末尾，逐条遵守。'

/** Imperative rules — the token-dense core the agent must obey. */
const RULES = [
  '协作规则：',
  '1. 新建用户级技能 → 写到 ~/.dsh/S-M-C/skills/<名>/（含 SKILL.md，frontmatter 需 name+description）。禁写 ~/.dsh/skills、~/.agents/skills 等库外目录。写入后未联接，用户在管理页联接并公告后可用。项目专用技能放当前项目的 .dsh/skills/。',
  '2. 技能加载：用 `skill` 工具加载技能；上方列出本机全部技能（超过 40 个时只列前 40 个，其余同样可用）。',
  '3. MCP：仅调已连接服务器的 mcp__<server>__<tool>；未连接/归档不可用，需用户激活。',
  '4. CLI：未注册为工具，经终端按名调用；「未找到」先装；未列出（隐藏）勿理会。',
  '5. 技能删除＝物理删除不可恢复，须先获用户确认。',
  '6. 启停/增删归用户：设置页「Web UI 插件 → 工具管理」。',
  '7. 数据在 ~/.dsh/S-M-C（MCP 凭证明文）；本清单每次对话重建，或有秒级延迟。',
].join('\n')

/** Cap on listed names, so a large library cannot bloat the system prompt. */
const MAX_NAMES = 40

/** Footer added when a list was truncated, so the agent knows it is partial. */
function truncatedNote(shown: number, total: number): string {
  return `（仅列出前 ${shown} 个，共 ${total} 个）`
}

/** Pick the enabled subset (MCP servers and CLI entries keep that flag). */
function enabledOnly<T extends { enabled: boolean }>(items: T[]): T[] {
  return items.filter((it) => it.enabled)
}

/**
 * Render the skills block (names + one-line purpose when present).
 *
 * Every skill is listed. There is deliberately no per-skill on/off flag here:
 * a skill under a `.dsh/skills` root is announced by dsh itself
 * (`<available_skills>` + the `skill` tool) whether or not this block mentions
 * it, and a store copy becomes loadable through the context engine's selection,
 * not through this text — so a switch here would control nothing but the width
 * of this paragraph.
 */
function renderSkills(skills: SkillSummary[]): string {
  if (skills.length === 0) return '技能：无。'
  const lines = [`技能：共 ${skills.length} 个。`]
  const detail = skills.slice(0, MAX_NAMES).map((s) => {
    const desc = s.description.trim()
    return desc === '' ? `- ${s.name}` : `- ${s.name}：${desc}`
  })
  lines.push('可用技能：', ...detail)
  if (skills.length > detail.length) lines.push(truncatedNote(detail.length, skills.length))
  return lines.join('\n')
}

/**
 * Render the MCP block (server + live connection status + tool namespace).
 *
 * Takes the combined list so an archived server can be called out as archived
 * rather than silently missing — otherwise the agent has no way to answer
 * "can I use the github MCP?" with anything better than a guess.
 */
function renderMcp(servers: McpServerSummary[]): string {
  const active = servers.filter((s) => !s.archived)
  const archived = servers.filter((s) => s.archived)
  if (active.length === 0) {
    if (archived.length === 0) return 'MCP 服务器：未配置。'
    return `MCP 服务器：全部 ${archived.length} 个已归档（定义在 ~/.dsh/S-M-C/mcp-archive.json，未连接，工具不可用，需用户激活后才能使用）。`
  }
  const on = enabledOnly(active)
  const lines = [`MCP 服务器：共 ${active.length} 个，其中启用 ${on.length} 个。`]
  for (const s of on.slice(0, MAX_NAMES)) {
    const state = s.status === 'running' ? '已连接'
      : s.status === 'failed' ? (s.error ? `连接失败：${s.error}` : '连接失败')
        : s.status === 'connecting' ? '连接中'
          : '未连接'
    lines.push(`- ${s.name}（${s.transport}，${state}）：工具名为 mcp__${s.name}__<tool>`)
  }
  if (on.length > MAX_NAMES) lines.push(truncatedNote(MAX_NAMES, on.length))
  const off = active.length - on.length
  if (off > 0) lines.push(`另有 ${off} 个未启用（未连接，工具不可用）。`)
  if (archived.length > 0) {
    lines.push(`另有 ${archived.length} 个已归档（定义在 ~/.dsh/S-M-C/mcp-archive.json，未连接，工具不可用，需用户激活后才能使用）。`)
  }
  return lines.join('\n')
}

/** Render the CLI block — the only place these tools are announced at all. */
function renderCli(entries: CliSummary[]): string {
  if (entries.length === 0) return '本地 CLI 工具：未发现。'
  const on = enabledOnly(entries)
  const installed = on.filter((e) => e.exists)
  const lines = [
    `本地 CLI 工具：共 ${entries.length} 个，其中公告中 ${on.length} 个、已安装 ${installed.length} 个。`,
  ]
  for (const e of on.slice(0, MAX_NAMES)) {
    const origin = e.source === 'skill' ? `来自技能 ${e.skill ?? ''}`.trim() : '系统 CLI'
    const where = e.exists ? `已安装${e.path ? '：' + e.path : ''}` : '未找到'
    lines.push(`- ${e.name}（${origin}，${where}）`)
  }
  if (on.length > MAX_NAMES) lines.push(truncatedNote(MAX_NAMES, on.length))
  const missing = on.length - installed.length
  if (missing > 0) lines.push(`其中 ${missing} 个未在本机找到，调用前需先安装。`)
  const off = entries.length - on.length
  if (off > 0) lines.push(`另有 ${off} 个已设为「隐藏」（不写进本公告），无需理会。`)
  return lines.join('\n')
}

/** Render one block, falling back to a placeholder if the read throws. */
function safe(label: string, render: () => string): string {
  try {
    return render()
  } catch {
    return `${label}：（读取失败，请以管理页为准）`
  }
}

export interface AnnounceSources {
  skills: SkillsManager
  mcp: McpManager
  cli: CliManager
}

/** Build the announcement text from the live managers. */
function build(sources: AnnounceSources, cwd?: string): string {
  const skills = safe('技能', () => renderSkills(sources.skills.listSkills(cwd)))
  const mcp = safe('MCP 服务器', () => renderMcp(sources.mcp.listForUi()))
  const cli = safe('本地 CLI 工具', () => renderCli(sources.cli.list(cwd)))
  return [INTRO, '', skills, '', mcp, '', cli, '', RULES].join('\n')
}

/**
 * How long a rendered announcement stays fresh.
 *
 * The provider runs on every prompt assembly, and an agent loop assembles more
 * than once per turn — rebuilding would repeat a four-root directory walk plus
 * a PATH walk each time. A few seconds is long enough to collapse those, short
 * enough that a change made in the management page shows up almost immediately.
 */
const CACHE_TTL_MS = 5_000

interface Cached {
  at: number
  cwd: string | undefined
  text: string
}
let cached: Cached | undefined

/** Drop the cached announcement so the next assembly rebuilds it. */
export function invalidateAnnouncement(): void {
  cached = undefined
}

/**
 * Build the announcement text for one prompt assembly (memoized).
 *
 * @param sources - the live managers to read from.
 * @param cwd - workspace root for project-scoped discovery, when known.
 */
export function renderAnnouncement(sources: AnnounceSources, cwd?: string): string {
  const now = Date.now()
  if (cached !== undefined && cached.cwd === cwd && now - cached.at < CACHE_TTL_MS) {
    return cached.text
  }
  const text = build(sources, cwd)
  cached = { at: now, cwd, text }
  return text
}
