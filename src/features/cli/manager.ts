/**
 * The CLI manager: two sources merged into one list.
 *
 * - `skill` — auto-discovered. A skill bundle that ships `scripts/run-cli.*` or
 *   `scripts/cli-state.*` is advertising a CLI it wraps, and its `cli-state`
 *   script is the authoritative probe when one exists.
 * - `registry` — user-declared rows in `cli.json`, seeded with `gh` / `git` /
 *   `tencent-news-cli`.
 *
 * A skill-provided CLI has no registry row of its own, so its 公告 flag comes
 * from a same-named row when one exists and reads as hidden otherwise. That is
 * why {@link setEnabled} upserts rather than editing in place.
 * @module
 */

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary,
} from '../../shared/protocol/index.ts'
import type { SkillsManager } from '../skills/index.ts'
import {
  IS_WIN, cliCommandFromScript, knownInstallPath, parseHelpCommands,
  resolveOnPath, runCliStateScript, runSync, toBool,
} from './probe.ts'
import {
  normalizeCliEntry, persistedEntries, validateCliEntry, writeCliConfig,
} from './registry.ts'

export { cliConfigPath, normalizeCliEntry, readCliConfig, validateCliEntry, writeCliConfig } from './registry.ts'

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
      const known = knownInstallPath(command)
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
    return persistedEntries().map((e) => {
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
      const known = knownInstallPath(s.command)
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
    for (const flag of ['--version', 'version']) {
      const r = runSync(resolved, [flag])
      if (r.ok && r.out) {
        return { name: s.name, exists: true, path: resolved, version: r.out.split('\n')[0] }
      }
    }
    return { name: s.name, exists: true, path: resolved, error: 'version not reported' }
  }

  /** Parse a CLI's `help` output into its subcommand list. */
  async listSubcommands(name: string, cwd?: string): Promise<CliSubcommands> {
    const found = this.list(cwd).find((s) => s.name === name)
    if (found === undefined) throw new Error('unknown cli: ' + name)
    const command = found.path ?? resolveOnPath(found.command) ?? knownInstallPath(found.command) ?? found.command
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
    return { name, command: found.command, subcommands: parseHelpCommands(helpOut), help: helpOut }
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
