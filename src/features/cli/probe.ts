/**
 * Process probing: resolving a command, running it, reading a skill's probe.
 *
 * Kept apart from the manager because this is the only place that spawns
 * processes, which makes it the only place worth auditing for that. The rule it
 * enforces: `list()` never executes anything the user has not opted into — it
 * walks PATH, which is a stat per candidate directory — and only an explicit
 * state probe or subcommand request runs a binary.
 * @module
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { toBool } from './registry.ts'

/** Whether we are on Windows, resolved once (junction/EXT/script choices). */
export const IS_WIN = process.platform === 'win32'

/** Walk PATH for an executable name without spawning it (portable, safe). */
export function resolveOnPath(command: string): string | undefined {
  const name = command.trim()
  if (name === '') return undefined
  const pathVar = process.env.PATH || ''
  const dirs = pathVar.split(IS_WIN ? ';' : ':').filter(Boolean)
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
export function runSync(cmd: string, args: string[], timeoutMs = 20_000): { ok: boolean; out: string; err: string } {
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

/**
 * Run a skill's `cli-state.*` probe script and parse its JSON document.
 *
 * A non-zero exit still gets a parse attempt: some probes exit non-zero with a
 * readable body, and the body is more useful than the exit code.
 */
export function runCliStateScript(scriptPath: string): { ok: boolean; data: Record<string, unknown> | null; error?: string } {
  const cmd = IS_WIN ? 'powershell' : 'sh'
  const args = IS_WIN
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
    : [scriptPath]
  const { ok, out, err } = runSync(cmd, args)
  if (!ok) {
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
export function cliCommandFromScript(scriptPath: string): string {
  const raw = readFileSync(scriptPath, 'utf8')
  // Handles `$CliCommandName = "x"` (PowerShell) and `CliCommandName="x"` (sh).
  const m = /^[ \t]*\$?[A-Za-z0-9_]*CliCommandName[ \t]*=[ \t]*["']([^"']+)["']/m.exec(raw)
  if (m) return m[1]
  return ''
}

/**
 * Best-effort known install path for a tool installed outside PATH.
 *
 * `tencent-news-cli` installs to a per-user directory rather than PATH, so a
 * PATH walk alone would report it missing on a machine where it works.
 */
export function knownInstallPath(command: string): string | undefined {
  if (command === 'tencent-news-cli') {
    const root = process.env.TENCENT_NEWS_INSTALL || join(homedir(), '.tencent-news-cli')
    const bin = IS_WIN ? join(root, 'bin', 'tencent-news-cli.exe') : join(root, 'bin', 'tencent-news-cli')
    return existsSync(bin) ? bin : undefined
  }
  return undefined
}

/** Parse `Available Commands:` / `Commands:` block into a subcommand list. */
export function parseHelpCommands(help: string): string[] {
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

/** Re-exported so the manager reads a probe boolean the same way the registry does. */
export { toBool }
