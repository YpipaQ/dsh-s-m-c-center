/**
 * Shared shapes and literals for the manager UI. Kept free of React and of the
 * API client so both the hooks layer and the view layer can import them without
 * creating a cycle.
 *
 * No copy lives here: labels are locale keys resolved by the caller with `t()`,
 * so an English shell never renders Chinese.
 */

import type { SkillsMcpKey } from '../locales.ts'

/** Editor payload for one MCP server: one flat record backing both UI modes. */
export interface McpForm {
  name: string
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string
  env: string
  cwd: string
  url: string
  headers: string
  mode: 'form' | 'json'
  json: string
}

/** Fresh editor state — a new object per call so callers never share it. */
export function emptyMcpForm(): McpForm {
  return {
    name: '', transport: 'stdio', command: '', args: '', env: '', cwd: '',
    url: '', headers: '', mode: 'form', json: '',
  }
}

/** The four management surfaces, in tab order. */
export const TABS = ['skills', 'mcp', 'cli', 'uninstall'] as const
export type TabId = (typeof TABS)[number]

/** Tab captions as locale keys (bilingual through the plugin's dictionary). */
export const TAB_LABELS: Record<TabId, SkillsMcpKey> = {
  skills: 'tabSkills',
  mcp: 'tabMcp',
  cli: 'tabCli',
  uninstall: 'tabUninstall',
}

/** Skill enablement filter options for the list toolbar. */
export type EnabledFilter = 'all' | 'enabled' | 'disabled'

/** MCP server runtime status → locale key. */
export const MCP_STATUS_LABEL: Record<string, SkillsMcpKey> = {
  connecting: 'stConnecting',
  running: 'stRunning',
  failed: 'stFailed',
  stopped: 'stStopped',
}

/**
 * The two states of a local CLI's announcement switch.
 *
 * A CLI is installed and run by the system — this plugin can neither start nor
 * stop it. The switch therefore controls exactly one thing: whether the CLI is
 * listed in the announcement handed to every agent (公告), or left out of it
 * (隐藏). Distinct from the plugin's own 「向 AI 公告」 switch, which announces
 * the plugin's capabilities rather than one tool.
 */
export const CLI_ANNOUNCE: { on: SkillsMcpKey; off: SkillsMcpKey } = {
  on: 'cliAdvertised',
  off: 'cliHidden',
}

/** Locale key for a CLI's announcement flag; absent or unrecognized → 隐藏. */
export function cliAnnounceLabel(advertised: boolean): SkillsMcpKey {
  return advertised ? CLI_ANNOUNCE.on : CLI_ANNOUNCE.off
}

/**
 * The two states of an MCP server's availability switch.
 *
 * Same vocabulary as {@link CLI_ANNOUNCE}: 激活 means the definition lives in
 * ~/.dsh/S-M-C/mcp.json and is really connected; 归档 means it was moved to
 * ~/.dsh/S-M-C/mcp-archive.json, so it is never connected and never announced.
 * The definition itself is preserved either way — archiving is not deleting.
 */
export const MCP_ACTIVE: { active: SkillsMcpKey; archived: SkillsMcpKey } = {
  active: 'activate',
  archived: 'archive',
}

/** Locale key for an MCP row's switch; a non-active row reads 归档. */
export function mcpActiveLabel(enabled: boolean): SkillsMcpKey {
  return enabled ? MCP_ACTIVE.active : MCP_ACTIVE.archived
}
