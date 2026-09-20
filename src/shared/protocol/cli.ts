/**
 * The CLI half of the wire contract: listed tools, probe details, parsed help.
 * @module
 */

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
  /** A first-boot hint row, not a real CLI: the UI renders it as an explanation. */
  virtual?: boolean
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
  /** The one-time first-boot hint row (deletable like any other row). */
  virtual?: boolean
}

/** A registry entry whose provided flag has been resolved (never undefined). */
export type NormalizedCliEntry = CliRegistryEntry & { enabled: boolean }
