/**
 * CLI manager — discovers the local command-line tools the agent can invoke
 * and reports/diagnoses their state. Two sources:
 *  - `skill`    : auto-discovered from a skill bundle that ships a
 *                 `scripts/run-cli.*` / `scripts/cli-state.*` wrapper (the
 *                 tencent-news pattern). The skill's `cli-state` script is the
 *                 authoritative probe when present.
 *  - `registry` : user-declared entries persisted in ~/.dsh/S-M-C/cli.json (mirrors
 *                 the mcp.json document), e.g. `gh`, `git`, `tencent-news-cli`.
 * Exists/path detection never spawns an untrusted binary (PATH walk only);
 * a full state probe / subcommand listing runs the resolved command on demand.
 * @module
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type {
  CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary, NormalizedCliEntry,
} from './protocol.ts'
import type { SkillsManager } from './skills.ts'
import { storeCliPath } from './store.ts'

/** Coerce a cli-state boolean (JSON boolean or the string "true"/"false"). */
function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    if (s === 'true' || s === '1') return true
    if (s === 'false' || s === '0') return false
  }
  return undefined
}

const IS_WIN = process.platform === 'win32'
/** Known well-known tool names the plugin watches out of the box. */
const DEFAULT_REGISTRY: CliRegistryEntry[] = [
  { name: 'gh', command: 'gh', enabled: false },
  { name: 'git', command: 'git', enabled: false },
  { name: 'tencent-news-cli', command: 'tencent-news-cli', enabled: false },
]

/** The store's CLI registry path (kept with the rest of the S-M-C data). */
export function cliConfigPath(): string {
  return storeCliPath()
}

/** Read the persisted registry document (never throws). */
export function readCliConfig(): { entries: CliRegistryEntry[] } {
  const target = cliConfigPath()
  try {
    if (!existsSync(target)) return { entries: [] }
    const raw = readFileSync(target, 'utf8')
    if (!raw || raw.trim() === '') return { entries: [] }
    const data = JSON.parse(raw) as { entries?: unknown }
    return {
      entries: Array.isArray(data.entries)
        ? (data.entries as CliRegistryEntry[]).filter((e) => e && typeof e.name === 'string')
        : [],
    }
  } catch {
    return { entries: [] }
  }
}

/** Persist the registry document (creating the directory when needed). */
export function writeCliConfig(data: { entries: CliRegistryEntry[] }): void {
  const target = cliConfigPath()
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, JSON.stringify(data, null, 2), 'utf8')
}

/** Validate one registry entry; returns an error string, or null when valid. */
export function validateCliEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return 'entry must be an object'
  const e = entry as CliRegistryEntry
  if (typeof e.name !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(e.name)) {
    return 'invalid name (1-64 chars of A-Za-z0-9_.-)'
  }
  if (e.command !== undefined && (typeof e.command !== 'string' || e.command.trim() === '')) {
    return 'command must be a non-empty string'
  }
  return null
}

/**
 * Normalize a registry entry to its persisted shape.
 *
 * `enabled` means "公告给 Agent" (advertised in the announcement) and is the
 * only two-state control this plugin has over a CLI — it cannot start or stop
 * one, since the system owns the executable. The flag is resolved through
 * {@link toBool} so a hand-edited cli.json carrying `"false"`, `"0"` or `0`
 * is read as 隐藏 instead of being silently promoted to 公告 — a plain
 * `!== false` check treats every non-`false` value (including the string
 * "false") as true. Anything unrecognized (missing, null, garbage) falls back
 * to the default: 隐藏. The value written back is always a real boolean, so
 * read and write agree on the shape and no invalid state can survive a save.
 */
export function normalizeCliEntry(entry: CliRegistryEntry): NormalizedCliEntry {
  const flag = toBool(entry.enabled)
  return {
    name: entry.name,
    command: (typeof entry.command === 'string' && entry.command.trim() !== '') ? entry.command : entry.name,
    // Hidden unless explicitly advertised: a CLI only reaches the agent through
    // the announcement, so opting in has to be deliberate.
    enabled: flag === true,
  }
}

/**
 * The registry entries as persisted, seeded with the built-ins when the file
 * is empty or missing.
 *
 * Seeding matters: {@link CliManager.list} falls back to {@link DEFAULT_REGISTRY}
 * for an empty document, so writing a single-entry document back would make the
 * built-ins vanish from the list. Every mutation therefore starts from the same
 * set the reader would have shown.
 */
function persistedEntries(): CliRegistryEntry[] {
  const config = readCliConfig()
  return config.entries.length > 0
    ? config.entries
    : DEFAULT_REGISTRY.map((e) => ({ ...e }))
}

/** Walk PATH for an executable name without spawning it (portable, safe). */
function resolveOnPath(command: string): string | undefined {
  const name = command.trim()
  if (name === '') return undefined
  const pathVar = process.env.PATH || ''
  const dirs = pathVar.split(process.platform === 'win32' ? ';' : ':').filter(Boolean)
  const exts = IS_WIN
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : ['']
  const candidates = IS_WIN
    ? [name, ...exts.map((ext) => name + ext.toLowerCase())]
    : [name]
  for (const dir of dirs) {
    for (const cand of candidates) {
      const full = join(dir, cand)
      if (existsSync(full)) return full
    }
  }
  return undefined
}

/** Run a command synchronously, capturing stdout/stderr. */
function runSync(cmd: string, args: string[], timeoutMs = 20_000): { ok: boolean; out: string; err: string } {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, windowsHide: true })
    return {
      ok: r.status === 0,
      out: (r.stdout || '').trim(),
      err: (r.stderr || '').trim() + (r.error && r.error.message ? `\n${r.error.message}` : ''),
    }
  } catch (e) {
    return { ok: false, out: '', err: String(e) }
  }
}

/** Run a skill's `cli-state.*` probe script and parse its JSON document. */
function runCliStateScript(scriptPath: string): { ok: boolean; data: Record<string, unknown> | null; error?: string } {
  const cmd = IS_WIN ? 'powershell' : 'sh'
  const args = IS_WIN
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
    : [scriptPath]
  const { ok, out, err } = runSync(cmd, args)
  if (!ok) {
    // Some probes exit non-zero with a readable JSON body; still try to parse.
    try {
      const parsed = JSON.parse(out) as Record<string, unknown>
      return { ok: true, data: parsed }
    } catch {
      return { ok: false, data: null, error: err || out || 'state script failed' }
    }
  }
  try {
    return { ok: true, data: JSON.parse(out) as Record<string, unknown> }
  } catch {
    return { ok: false, data: null, error: 'state script did not return JSON' }
  }
}

/** Extract the wrapped CLI command name from a skill's run-cli script. */
function cliCommandFromScript(scriptPath: string): string {
  const raw = readFileSync(scriptPath, 'utf8')
  // Handles `$CliCommandName = "x"` (PowerShell) and `CliCommandName="x"` (sh).
  const m = /^[ \t]*\$?[A-Za-z0-9_]*CliCommandName[ \t]*=[ \t]*["']([^"']+)["']/m.exec(raw)
  if (m) return m[1]
  return ''
}

/**
 * Owns skill-derived CLI discovery plus the persisted registry. Runs in the
 * Host process; only PATH walks happen during `list`, heavier probes on demand.
 */
export class CliManager {
  constructor(private readonly skills: SkillsManager) {}

  /** One element of the merged CLI list, still independent of registry state. */
  private skillEntries(cwd?: string): CliSummary[] {
    const items: CliSummary[] = []
    // A skill-provided CLI has no registry entry of its own, so its advertised
    // flag comes from a same-named registry row when one exists — and reads as
    // hidden otherwise, which is the default for every CLI.
    const advertised = new Set(
      persistedEntries().filter((e) => normalizeCliEntry(e).enabled).map((e) => e.name),
    )
    for (const skill of this.skills.listSkills(cwd)) {
      const skillDir = skill.path.split(/[\\/]/).slice(0, -1).join('/')
      const scriptsDir = join(skillDir, 'scripts')
      if (!existsSync(scriptsDir)) continue
      const entries = readdirSync(scriptsDir, { withFileTypes: true })
      const scriptName = IS_WIN ? 'run-cli.ps1' : 'run-cli.sh'
      const stateName = IS_WIN ? 'cli-state.ps1' : 'cli-state.sh'
      const runScript = entries.some((e) => e.isFile() && e.name === scriptName)
        ? join(scriptsDir, scriptName)
        : undefined
      const stateScript = entries.some((e) => e.isFile() && e.name === stateName)
        ? join(scriptsDir, stateName)
        : undefined
      if (runScript === undefined && stateScript === undefined) continue
      const command = (runScript !== undefined ? cliCommandFromScript(runScript) : '') || skill.name
      if (command === '') continue
      const resolved = resolveOnPath(command)
      const known = this.knownInstallPath(command)
      items.push({
        name: command,
        command,
        source: 'skill',
        skill: skill.name,
        runScript,
        stateScript,
        enabled: advertised.has(command),
        exists: resolved !== undefined || known !== undefined,
        path: resolved ?? known,
      })
    }
    return items
  }

  /** Registry entries mapped to summary form (path detection only). */
  private registryEntries(): CliSummary[] {
    // Same seed the mutators use, so what the list shows and what a toggle
    // edits are always the same set.
    const entries = persistedEntries()
    return entries.map((e) => {
      const normalized = normalizeCliEntry(e)
      const resolved = resolveOnPath(normalized.command)
      return {
        name: normalized.name,
        command: normalized.command,
        source: 'registry',
        enabled: normalized.enabled,
        exists: resolved !== undefined,
        path: resolved,
      }
    })
  }

  /** Merge skill-derived and registry CLI entries into the UI list. */
  list(cwd?: string): CliSummary[] {
    const byName = new Map<string, CliSummary>()
    for (const s of this.skillEntries(cwd)) byName.set(s.name, s)
    for (const r of this.registryEntries()) {
      if (byName.has(r.name)) continue
      byName.set(r.name, r)
    }
    const items = [...byName.values()]
    items.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'skill' ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    return items
  }

  /** Probe one CLI's detailed state (cli-state script, else version). */
  async readState(name: string, cwd?: string): Promise<CliStateDetail> {
    const all = this.list(cwd)
    const found = all.find((s) => s.name === name)
    if (found === undefined) return { name, exists: false, error: 'unknown cli: ' + name }

    // Skill-provided state script is authoritative.
    if (found.source === 'skill' && found.stateScript && existsSync(found.stateScript)) {
      const { ok, data, error } = runCliStateScript(found.stateScript)
      if (ok && data) {
        const cliExists = toBool(data.cliExists) ?? false
        const platform = (data.platform ?? {}) as Record<string, unknown>
        const update = (data.update ?? {}) as Record<string, unknown>
        const apiKey = (data.apiKey ?? {}) as Record<string, unknown>
        return {
          name,
          exists: cliExists,
          path: typeof platform.cliPath === 'string' ? platform.cliPath : found.path,
          needUpdate: toBool(update.needUpdate),
          apiKey: {
            status: typeof apiKey.status === 'string' ? apiKey.status : undefined,
            present: toBool(apiKey.present),
            error: typeof apiKey.error === 'string' ? apiKey.error : undefined,
          },
          platform: {
            os: typeof platform.os === 'string' ? platform.os : undefined,
            arch: typeof platform.arch === 'string' ? platform.arch : undefined,
            cliPath: typeof platform.cliPath === 'string' ? platform.cliPath : undefined,
            cliSource: typeof platform.cliSource === 'string' ? platform.cliSource : undefined,
          },
        }
      }
      // Fall through to generic detection but remember the script error.
      const generic = this.genericState(found)
      Object.assign(generic, { error })
      return generic
    }

    // Generic detection: resolve on PATH (or a known install dir), then version.
    return this.genericState(found)
  }

  /** Generic version probe for a non-skill CLI. */
  private genericState(s: CliSummary): CliStateDetail {
    const resolved = s.path ?? resolveOnPath(s.command)
    if (resolved === undefined) {
      const known = this.knownInstallPath(s.command)
      if (known !== undefined) {
        const r = runSync(known, ['--version'])
        return {
          name: s.name,
          exists: true,
          path: known,
          version: r.ok ? r.out.split('\n')[0] : undefined,
          error: r.ok ? undefined : (r.err || 'version check failed'),
        }
      }
      return { name: s.name, exists: false }
    }
    // Prefer a single `--version`, then `version`.
    const probes: Array<[string, string[]]> = [['--version', []], ['version', []]]
    for (const [flag, rest] of probes) {
      const r = runSync(resolved, [flag, ...rest])
      if (r.ok && r.out) {
        return {
          name: s.name,
          exists: true,
          path: resolved,
          version: r.out.split('\n')[0],
        }
      }
    }
    return { name: s.name, exists: true, path: resolved, error: 'version not reported' }
  }

  /** Best-effort known install path for a tool installed outside PATH. */
  private knownInstallPath(command: string): string | undefined {
    if (command === 'tencent-news-cli') {
      const root = process.env.TENCENT_NEWS_INSTALL || join(homedir(), '.tencent-news-cli')
      const bin = IS_WIN ? join(root, 'bin', 'tencent-news-cli.exe') : join(root, 'bin', 'tencent-news-cli')
      return existsSync(bin) ? bin : undefined
    }
    return undefined
  }

  /** Parse a CLI's `help` output into its subcommand list. */
  async listSubcommands(name: string, cwd?: string): Promise<CliSubcommands> {
    const all = this.list(cwd)
    const found = all.find((s) => s.name === name)
    if (found === undefined) throw new Error('unknown cli: ' + name)
    const command = found.path ?? resolveOnPath(found.command) ?? this.knownInstallPath(found.command) ?? found.command
    // Run the skill's run-cli wrapper first when present (it injects caller).
    let helpOut = ''
    if (found.source === 'skill' && found.runScript && existsSync(found.runScript)) {
      const cmd = IS_WIN ? 'powershell' : 'sh'
      const args = IS_WIN
        ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', found.runScript, 'help']
        : [found.runScript, 'help']
      const r = runSync(cmd, args)
      helpOut = r.out || r.err
    } else {
      const r = runSync(command, ['help'])
      if (!r.ok) {
        const r2 = runSync(command, ['--help'])
        helpOut = (r2.out || r2.err) || (r.out || r.err)
      } else {
        helpOut = r.out
      }
    }
    const subcommands = parseHelpCommands(helpOut)
    return { name, command: found.command, subcommands, help: helpOut }
  }

  /** Registry mutation: upsert one entry. */
  saveEntry(entry: CliRegistryEntry): CliRegistryEntry {
    const normalized = normalizeCliEntry(entry)
    const entries = persistedEntries()
    const idx = entries.findIndex((e) => e.name === normalized.name)
    if (idx >= 0) entries[idx] = normalized
    else entries.push(normalized)
    writeCliConfig({ entries: entries.map(normalizeCliEntry) })
    return normalized
  }

  /**
   * Registry mutation: set whether a CLI is advertised to the agent.
   *
   * Upserts, so it also works for a skill-provided CLI, which has no registry
   * entry of its own: flipping such a row writes one, and that entry is what
   * {@link skillEntries} reads back. The document is seeded from the built-ins
   * first, so toggling a built-in always lands instead of silently no-oping.
   */
  setEnabled(name: string, enabled: boolean): void {
    const entries = persistedEntries()
    const entry = entries.find((e) => e.name === name)
    const flag = enabled === true
    if (entry === undefined) entries.push({ name, command: name, enabled: flag })
    else entry.enabled = flag
    writeCliConfig({ entries: entries.map(normalizeCliEntry) })
  }

  /**
   * Registry mutation: remove one entry.
   * Seeded from the built-ins first, so deleting one of them actually sticks —
   * writing an empty document would just reinstate the fallback list on read.
   */
  removeEntry(name: string): void {
    const entries = persistedEntries().filter((e) => e.name !== name)
    writeCliConfig({ entries: entries.map(normalizeCliEntry) })
  }
}

/** Parse `Available Commands:` / `Commands:` block into a subcommand list. */
function parseHelpCommands(help: string): string[] {
  const lines = help.split(/\r?\n/)
  const result: string[] = []
  let capture = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^(available commands|commands):\s*$/i.test(trimmed)) { capture = true; continue }
    if (capture) {
      if (trimmed === '') break
      const m = /^([a-z][a-z0-9_-]*)/i.exec(trimmed)
      if (m && !/^usage|^flags|^help/i.test(m[1])) result.push(m[1])
    }
  }
  return result
}
