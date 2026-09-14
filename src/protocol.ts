/**
 * Wire contract shared by the two halves of the plugin: every type that crosses
 * /api/dsh-skills-mcp, plus the path constants for that route family — the one
 * place a route rename has to be applied. Types only otherwise; the browser
 * half imports no Host value from here.
 * @module
 */

/** Which of the four roots a skill was found under. */
export type SkillSource = 'project-dsh' | 'project-agents' | 'user-dsh' | 'user-agents'

/** How the UI groups skills: by the workspace they belong to, or the user. */
export type SkillLevel = 'project' | 'user'

/** One row of the skills list. */
export interface SkillSummary {
  /** Skill name, from SKILL.md frontmatter. */
  name: string
  /** One-line summary from frontmatter (dsh requires it). */
  description: string
  /** Optional "when to use this" note ('' when frontmatter has none). */
  whenToUse: string
  /** False when this manager has the skill switched off. */
  enabled: boolean
  /** The root it lives under, which also decides its level. */
  source: SkillSource
  level: SkillLevel
  /** A directory holding SKILL.md, or a single flat `.md` file. */
  kind: 'bundle' | 'file'
  /** Absolute path of the SKILL.md (bundle) or of the `.md` file. */
  path: string
  /**
   * True when the canonical copy lives in the store, making this row
   * link-managed: enabling adds a link under the source root, disabling
   * removes it, and the SKILL.md is never rewritten.
   */
  managed: boolean
  /** Store directory name; present exactly when `managed` is true. */
  slug?: string
}

/** One skill including its body, for the detail pane. */
export interface SkillDetail {
  name: string
  description: string
  whenToUse: string
  enabled: boolean
  /** Markdown body with the frontmatter block stripped. */
  content: string
  path: string
}

/** A skill candidate found by scanning a directory the user picked. */
export interface ScannedSkill {
  name: string
  description: string
  /** Where to import from: the bundle directory, or the `.md` file. */
  sourcePath: string
  kind: 'bundle' | 'file'
}

/** One checked row of a scan, sent back to be imported. */
export interface ImportItem {
  sourcePath: string
  kind: 'bundle' | 'file'
}

/**
 * One skill held in the store: the canonical copy lives under
 * `~/.dsh/S-M-C/skills/<slug>/` and is linked into `source`'s root only while
 * it is enabled. `origin` records where it came from so a migration can be
 * undone.
 */
export interface StoreEntry {
  /** Store directory name (unique within the store). */
  slug: string
  /** Skill name from SKILL.md at adopt time. */
  name: string
  /** Absolute path the skill lived at before it was adopted. */
  origin: string
  /** Root the enabled link is written back to. */
  source: SkillSource
  enabled: boolean
  adoptedAt: string
}

/** Persisted store manifest (`~/.dsh/S-M-C/skills/index.json`). */
export interface StoreIndex {
  version: 1
  /** ISO timestamp of the one-shot migration, when it has run. */
  migratedAt?: string
  entries: StoreEntry[]
  /** Skills the last migration could not move (left in place, still usable). */
  failures?: StoreFailure[]
}

/** One skill the migration could not move. */
export interface StoreFailure {
  path: string
  reason: string
}

/** Outcome of a migration or rollback run. */
export interface StoreOperation {
  /** Number of skills moved (or restored, for a rollback). */
  moved: number
  failures: StoreFailure[]
}

/** Store state shown in the UI banner. */
export interface StoreStatus {
  /** The unified store root (e.g. `~/.dsh/S-M-C`), shown verbatim in the UI. */
  root: string
  /** The skills directory inside it. */
  dir: string
  migrated: boolean
  migratedAt?: string
  /** Skills currently held in the store. */
  count: number
  enabled: number
  failures: StoreFailure[]
}

/** Result of importing one skill. */
export interface ImportResult {
  name: string
  ok: boolean
  reason?: string
}

/** MCP transport kinds the manager supports. */
export type McpTransport = 'stdio' | 'streamable-http'

/** One persisted MCP server definition (a row of `mcp.json`). */
export interface McpServerConfig {
  /** Server name; also the namespace its tools register under. */
  name: string
  transport: McpTransport
  /** Absent counts as active — only an explicit `false` means archived. */
  enabled?: boolean
  // stdio fields
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  // streamable-http fields
  url?: string
  headers?: Record<string, string>
}

/** Connection state the manager reports for one server. */
export type McpConnectionStatus = 'connecting' | 'running' | 'failed' | 'stopped'

/**
 * One MCP server as returned to the UI (full config + live connection state).
 *
 * `enabled` is narrowed to a concrete boolean here: the host's `summarize()`
 * resolves the optional persisted flag (`enabled !== false`) before sending, so
 * the browser never has to treat "absent" and "true" as different states.
 */
export interface McpServerSummary extends Omit<McpServerConfig, 'enabled'> {
  enabled: boolean
  status: McpConnectionStatus
  error?: string
  /**
   * True when the definition lives in `~/.dsh/S-M-C/mcp-archive.json` instead of the
   * active document. Archived servers are never connected and never announced;
   * `enabled` is false for them too, so a single switch still reads correctly.
   */
  archived: boolean
}

/** Persisted archive document (`~/.dsh/S-M-C/mcp-archive.json`). */
export interface McpArchive {
  version: 1
  servers: McpServerConfig[]
}

/** One CLI tool's source: auto-discovered from a skill's wrapper scripts, or a user registry entry. */
export type CliSource = 'skill' | 'registry'

/** One local CLI tool as listed in the UI (auto-discovered or registered). */
export interface CliSummary {
  /** CLI command name (e.g. `tencent-news-cli`). */
  name: string
  /** Invocation name the agent would run. */
  command: string
  source: CliSource
  /** Owning skill name when `source === 'skill'`. */
  skill?: string
  /** Path to the skill's `run-cli` wrapper script, when present. */
  runScript?: string
  /** Path to the skill's `cli-state` probe script, when present. */
  stateScript?: string
  /** Whether the registry/system entry is enabled. */
  enabled: boolean
  /** Whether the executable resolves on PATH (or a known global install dir). */
  exists: boolean
  /** Resolved executable path, when found. */
  path?: string
}

/** Detailed probe state for one CLI, fetched lazily. */
export interface CliStateDetail {
  name: string
  exists: boolean
  path?: string
  version?: string
  needUpdate?: boolean
  apiKey?: { status?: string; present?: boolean; error?: string }
  platform?: { os?: string; arch?: string; cliPath?: string; cliSource?: string }
  error?: string
}

/** Parsed `help` output for one CLI: its subcommand list plus raw help text. */
export interface CliSubcommands {
  name: string
  command: string
  subcommands: string[]
  help: string
}

/** One persisted registry entry (a user-declared CLI the plugin watches). */
export interface CliRegistryEntry {
  /** CLI command name (unique). */
  name: string
  /** Invocation name (defaults to `name`). */
  command: string
  /**
   * Whether the CLI is announced to the agent: 公告 (true) or 隐藏 (false).
   *
   * This plugin cannot start or stop a CLI — the system owns the executable —
   * so the flag only decides whether the CLI appears in the announcement.
   * Optional in the persisted document because cli.json is hand-editable and
   * may omit it; the default is 隐藏. After normalization (see
   * {@link NormalizedCliEntry}) the flag is always a resolved boolean.
   */
  enabled?: boolean
}

/** A registry entry whose provided flag has been resolved (never undefined). */
export type NormalizedCliEntry = CliRegistryEntry & { enabled: boolean }

/** The plugin's own config (mirrors the host-side `Config` schema). */
export interface ManagerSettings {
  /** Master switch: routes, MCP connections, prompt section. */
  enabled: boolean
  /** Announce the plugin to every agent's system prompt. */
  announceToAgent: boolean
}

/** API paths shared by the host routes and the browser api client. */
export const SKILLS_MCP_API = {
  skills: '/api/dsh-skills-mcp/skills',
  skillRead: '/api/dsh-skills-mcp/skills/read',
  skillToggle: '/api/dsh-skills-mcp/skills/toggle',
  skillDelete: '/api/dsh-skills-mcp/skills/delete',
  skillScan: '/api/dsh-skills-mcp/skills/scan',
  skillImport: '/api/dsh-skills-mcp/skills/import',
  skillStore: '/api/dsh-skills-mcp/skills/store',
  skillRollback: '/api/dsh-skills-mcp/skills/rollback',
  /** Re-run the one-shot migration after a rollback (the uninstall page's undo). */
  skillRemigrate: '/api/dsh-skills-mcp/skills/remigrate',
  mcp: '/api/dsh-skills-mcp/mcp',
  mcpSave: '/api/dsh-skills-mcp/mcp/save',
  /** Activate (true) or archive (false) a definition — see McpServerSummary.archived. */
  mcpEnabled: '/api/dsh-skills-mcp/mcp/enabled',
  /** Move every archived definition back into the active document (uninstall page). */
  mcpRestoreAll: '/api/dsh-skills-mcp/mcp/restore-all',
  mcpDelete: '/api/dsh-skills-mcp/mcp/delete',
  mcpTest: '/api/dsh-skills-mcp/mcp/test',
  cli: '/api/dsh-skills-mcp/cli',
  cliState: '/api/dsh-skills-mcp/cli/state',
  cliSubcommands: '/api/dsh-skills-mcp/cli/subcommands',
  cliSave: '/api/dsh-skills-mcp/cli/save',
  cliEnabled: '/api/dsh-skills-mcp/cli/enabled',
  cliDelete: '/api/dsh-skills-mcp/cli/delete',
  cliProbe: '/api/dsh-skills-mcp/cli/probe',
  settings: '/api/dsh-skills-mcp/settings',
  settingsSave: '/api/dsh-skills-mcp/settings/save',
} as const
