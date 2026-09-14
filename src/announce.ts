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

import type { CliManager } from './cli.ts'
import type { McpManager } from './mcp.ts'
import type { SkillsManager } from './skills.ts'
import type { CliSummary, McpServerSummary, SkillSummary } from './protocol.ts'

/** Static framing: what the plugin is and what it can do. */
const INTRO = [
  '本机已安装 dsh-s-m-c-center 插件（工具管理：技能 / MCP / CLI 管理器）。',
  '能力：浏览/启用/不启用/删除/导入技能；管理 MCP 服务器（stdio 与 streamable-http）；',
  '以及本地 CLI 工具清单与状态（是否安装 / 版本 / 需更新 / 子命令 / API-Key 状态）。',
  'MCP 为真实连接：激活的服务器经 @deepseek-ai/dsh-mcp-client 连接，工具注册为 mcp__<server>__<tool>，激活/归档会实际连接/断开。',
].join('')

/** Caveats the agent should know before promising anything. */
const LIMITS = [
  '注册新技能：为用户新建用户级技能时，把技能文件夹直接创建到 ~/.dsh/S-M-C/skills/<技能名>/（内含 SKILL.md，frontmatter 需有 name 与 description），不要写到 ~/.dsh/skills、~/.agents/skills 等储存库外的目录 —— 只有储存库里的技能才会被统一管理。写入后它会以「未启用」出现在管理页，用户启用（注入联接）后你即可通过 `skill` 工具加载；项目专用技能仍放当前项目的 .dsh/skills/。',
  '限制：本插件的数据统一存 ~/.dsh/S-M-C（MCP 激活 mcp.json、归档 mcp-archive.json、CLI 注册表 cli.json；密码/env 明文）；',
  '用户级技能的正本在 ~/.dsh/S-M-C/skills，启用/不启用等于在 skills 目录增删联接，不改写 SKILL.md；删除为物理删除，不可恢复。',
  '本清单在每次对话组装时生成，可能与管理页的即时操作有一处延迟。',
].join('')

/** How to reach the management surface — the GUI path is for the human. */
const ENTRY = '用户（而非你）可在设置页「Web UI 插件 → 工具管理」调整上述配置。'

/** Cap on listed names, so a large library cannot bloat the system prompt. */
const MAX_NAMES = 40

/** Footer added when a list was truncated, so the agent knows it is partial. */
function truncatedNote(shown: number, total: number): string {
  return `（仅列出前 ${shown} 个，共 ${total} 个）`
}

/** Pick the enabled subset, preserving input order. */
function enabledOnly<T extends { enabled: boolean }>(items: T[]): T[] {
  return items.filter((it) => it.enabled)
}

/** Render the skills block (names + one-line purpose when present). */
function renderSkills(skills: SkillSummary[]): string {
  if (skills.length === 0) return '技能：无。'
  const on = enabledOnly(skills)
  const lines = [`技能：共 ${skills.length} 个，其中可用 ${on.length} 个。`]
  const detail = on.slice(0, MAX_NAMES).map((s) => {
    const desc = s.description.trim()
    return desc === '' ? `- ${s.name}` : `- ${s.name}：${desc}`
  })
  if (detail.length > 0) lines.push('可用技能：', ...detail)
  if (on.length > detail.length) lines.push(truncatedNote(detail.length, on.length))
  const off = skills.length - on.length
  if (off > 0) lines.push(`另有 ${off} 个已禁用。通过 \`skill\` 工具按名称加载上述可用技能。`)
  else lines.push('通过 `skill` 工具按名称加载上述技能。')
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
  lines.push('这些 CLI 未在工具列表中注册；如需使用，请通过终端/命令工具按上述名称调用。')
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
  return [INTRO, '', skills, '', mcp, '', cli, '', LIMITS, ENTRY].join('\n')
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
