/**
 * CLI registry save/read consistency.
 *
 * The announce flag (公告 / 隐藏) is the only control on a local CLI, so it
 * has to survive a round trip through ~/.dsh/S-M-C/cli.json no matter what a
 * hand-edited document contains. These tests pin the invariant that reading and
 * writing agree: every persisted `enabled` is a real boolean, and the set the
 * list shows is the set a mutation edits.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CliManager, cliConfigPath, normalizeCliEntry, writeCliConfig } from '../src/features/cli/index.ts'

/** Isolated DSH_HOME so the real ~/.dsh/S-M-C/cli.json is never touched. */
let home: string
let origHome: string | undefined

beforeEach(() => {
  home = join(tmpdir(), 'dsh-cli-test-' + Math.random().toString(36).slice(2))
  mkdirSync(home, { recursive: true })
  origHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  rmSync(home, { recursive: true, force: true })
})

/** The persisted document, or undefined when no file was written. */
function persisted(): { entries: Array<{ name: string; enabled?: unknown }> } | undefined {
  const target = cliConfigPath()
  return existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : undefined
}

/** A manager with no skills, so only registry entries are in play. */
function manager(): CliManager {
  return new CliManager({ listSkills: () => [] } as never)
}

/** enabled flags keyed by CLI name. */
function flags(): Record<string, boolean> {
  return Object.fromEntries(manager().list().map((e) => [e.name, e.enabled]))
}

describe('normalizeCliEntry — provided flag resolution', () => {
  it('reads real booleans as-is', () => {
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: true }).enabled).toBe(true)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: false }).enabled).toBe(false)
  })

  it('reads the string forms a hand-edited cli.json carries', () => {
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: 'true' }).enabled).toBe(true)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: '1' }).enabled).toBe(true)
    // The trap: treating anything-but-false as advertised would let a stray
    // value push a CLI into the announcement.
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: 'false' }).enabled).toBe(false)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: '0' }).enabled).toBe(false)
  })

  it('defaults to 隐藏 for missing or unrecognized values', () => {
    expect(normalizeCliEntry({ name: 'a', command: 'a' }).enabled).toBe(false)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: undefined }).enabled).toBe(false)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: null as never }).enabled).toBe(false)
    expect(normalizeCliEntry({ name: 'a', command: 'a', enabled: 'maybe' as never }).enabled).toBe(false)
  })

  it('falls back to the name when command is blank', () => {
    expect(normalizeCliEntry({ name: 'a', command: '  ' }).command).toBe('a')
  })
})

describe('list — reading what was persisted', () => {
  it('surfaces legacy string flags correctly', () => {
    writeCliConfig({ entries: [
      { name: 'gh', command: 'gh', enabled: 'false' },
      { name: 'git', command: 'git' },
    ] })
    expect(flags()).toEqual({ gh: false, git: false })
  })

  it('hides every built-in by default when the document is empty', () => {
    expect(manager().list()).toHaveLength(3)
    expect(Object.values(flags()).every((v) => v === false)).toBe(true)
  })
})

describe('setEnabled — write agrees with read', () => {
  it('writes a pure boolean, replacing any legacy value', () => {
    writeCliConfig({ entries: [{ name: 'gh', command: 'gh', enabled: 'false' }] })
    const mgr = manager()
    mgr.setEnabled('gh', true)
    expect(persisted()?.entries[0].enabled).toBe(true)
    expect(typeof persisted()?.entries[0].enabled).toBe('boolean')
  })

  it('persists a toggle on a built-in even when cli.json is absent', () => {
    const mgr = manager()
    mgr.setEnabled('git', false)
    expect(persisted()).toBeDefined()
    expect(flags().git).toBe(false)
    // Siblings are carried over, not silently dropped.
    expect(persisted()?.entries).toHaveLength(3)
    expect(flags().gh).toBe(false)
  })

  it('registers an unknown name, so a skill-provided CLI can be advertised', () => {
    const mgr = manager()
    mgr.setEnabled('nope', true)
    expect(persisted()?.entries.some((e) => e.name === 'nope')).toBe(true)
    expect(flags().nope).toBe(true)
  })
})

describe('saveEntry — registering keeps the built-ins', () => {
  it('does not make the built-ins vanish', () => {
    const mgr = manager()
    mgr.saveEntry({ name: 'mycli', command: 'mycli', enabled: true })
    expect(persisted()?.entries).toHaveLength(4)
    expect(mgr.list()).toHaveLength(4)
    expect(flags().mycli).toBe(true)
  })

  it('upserts by name', () => {
    const mgr = manager()
    mgr.saveEntry({ name: 'mycli', command: 'mycli', enabled: true })
    mgr.saveEntry({ name: 'mycli', command: 'mycli', enabled: false })
    expect(persisted()?.entries).toHaveLength(4)
    expect(flags().mycli).toBe(false)
  })
})

describe('removeEntry — deletion sticks', () => {
  it('removing a built-in is not undone by the default fallback', () => {
    const mgr = manager()
    mgr.removeEntry('gh')
    expect(persisted()?.entries.some((e) => e.name === 'gh')).toBe(false)
    expect(mgr.list().some((e) => e.name === 'gh')).toBe(false)
    // 3 built-ins minus the deleted one.
    expect(mgr.list()).toHaveLength(2)
  })
})

describe('invariant', () => {
  it('every persisted flag is a real boolean after any mutation', () => {
    writeCliConfig({ entries: [
      { name: 'gh', command: 'gh', enabled: 'false' },
      { name: 'git', command: 'git', enabled: 0 },
      { name: 'x', command: 'x' },
    ] })
    const mgr = manager()
    mgr.setEnabled('git', true)
    mgr.saveEntry({ name: 'y', command: 'y' })
    mgr.removeEntry('x')
    const doc = persisted()
    expect(doc).toBeDefined()
    for (const e of doc!.entries) {
      expect(typeof e.enabled).toBe('boolean')
    }
  })
})
