/**
 * Uninstall preparation: the give-back flow and its undo.
 *
 * 归还 (give back) has two halves, tested separately here:
 * - skills: rollbackMigration() moves every stored bundle back to its original
 *   location and drops the manifest; reMigrate() is the undo — it re-runs the
 *   one-shot migration, including the case where a rollback with failures kept
 *   the manifest (and its migratedAt marker) alive.
 * - mcp: activateAll() moves every archived definition back into the active
 *   document in one pass. MCP has no undo by design — a server can be archived
 *   again individually — so nothing beyond the restore is pinned.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { SkillsManager } from '../src/skills.ts'
import { McpManager, readMcpArchive, readMcpConfig, writeMcpConfig } from '../src/mcp.ts'
import { storeRoot, storeSkillsDir } from '../src/store.ts'
import type { McpServerConfig } from '../src/protocol.ts'

let home: string
let agents: string
let origHome: string | undefined
let origAgents: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-uninstall-' + id)
  agents = join(tmpdir(), 'dsh-uninstall-agents-' + id)
  mkdirSync(home, { recursive: true })
  mkdirSync(agents, { recursive: true })
  origHome = process.env.DSH_HOME
  origAgents = process.env.DSH_AGENTS_HOME
  process.env.DSH_HOME = home
  process.env.DSH_AGENTS_HOME = agents
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  if (origAgents === undefined) delete process.env.DSH_AGENTS_HOME
  else process.env.DSH_AGENTS_HOME = origAgents
  rmSync(home, { recursive: true, force: true })
  rmSync(agents, { recursive: true, force: true })
})

/** A bundle skill (`<root>/<dir>/SKILL.md`). */
function bundle(root: string, dir: string, name: string): string {
  const target = join(root, dir)
  mkdirSync(target, { recursive: true })
  writeFileSync(
    join(target, 'SKILL.md'),
    ['---', 'name: ' + name, 'description: desc of ' + name, '---', 'body of ' + name].join('\n'),
    'utf8',
  )
  return target
}

/** A stdio server definition. */
function stdio(name: string): McpServerConfig {
  return { name, transport: 'stdio', command: 'npx', args: ['-y', name] }
}

const userSkills = () => join(home, 'skills')
const mcp = () => new McpManager({} as Context)

describe('reMigrate (undo of the skills give-back)', () => {
  it('re-adopts skills after a successful rollback', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()
    expect(skills.storeStatus().count).toBe(1)

    const back = skills.rollbackMigration()
    expect(back.moved).toBe(1)
    expect(skills.storeStatus().count).toBe(0)

    const again = skills.reMigrate()
    expect(again.moved).toBe(1)
    const status = skills.storeStatus()
    expect(status.migrated).toBe(true)
    expect(status.count).toBe(1)
    expect(status.linked).toBe(1)
  })

  it('restores the original body (no frontmatter rewriting beyond invocation flags)', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()
    skills.rollbackMigration()
    skills.reMigrate()
    const raw = readFileSync(join(userSkills(), 'demo', 'SKILL.md'), 'utf8')
    expect(raw).toContain('name: demo')
    expect(raw).toContain('body of demo')
  })

  it('is a safe no-op while the migration is still in force', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()
    expect(skills.reMigrate().moved).toBe(0)
    expect(skills.storeStatus().count).toBe(1)
  })

  it('re-runs even when a failed rollback kept the manifest alive', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()
    // Simulate a rollback failure: the entry survives with no origin path, so
    // rollbackMigration() reports a failure and keeps index.json (marker and
    // all) — the state reMigrate() must be able to see past.
    const skillsAny = skills as unknown as { writeStoreIndex: (i: unknown) => void }
    const index = (skills as unknown as { readStoreIndex: () => { entries: Array<Record<string, unknown>> } }).readStoreIndex()
    index.entries = index.entries.map((e) => ({ ...e, origin: '' }))
    skillsAny.writeStoreIndex(index)

    const rolled = skills.rollbackMigration()
    expect(rolled.failures.length).toBe(1)
    // The marker survived the failed rollback; reMigrate clears it and re-runs.
    expect(skills.reMigrate().moved).toBe(0)
    expect(skills.storeStatus().migrated).toBe(true)
    expect(skills.storeStatus().count).toBe(1)
  })

  it('writes the store under the unified root', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()
    expect(storeSkillsDir().startsWith(storeRoot())).toBe(true)
  })
})

describe('activateAll (MCP half of the give-back)', () => {
  it('moves every archived definition back in one pass', () => {
    writeMcpConfig({ servers: [stdio('a'), stdio('b'), stdio('live')] })
    const m = mcp()
    m.archiveServer('a')
    m.archiveServer('b')
    expect(readMcpConfig().servers.map((s) => s.name)).toEqual(['live'])
    expect(readMcpArchive().servers.map((s) => s.name)).toEqual(['a', 'b'])

    const restored = m.activateAll()
    expect(restored).toBe(2)
    expect(readMcpArchive().servers).toEqual([])
    const names = readMcpConfig().servers.map((s) => s.name)
    expect(names).toContain('a')
    expect(names).toContain('b')
    expect(names).toContain('live')
    expect(readMcpConfig().servers.find((s) => s.name === 'a')?.enabled).toBe(true)
  })

  it('returns 0 and touches nothing when the archive is empty', () => {
    writeMcpConfig({ servers: [stdio('live')] })
    expect(mcp().activateAll()).toBe(0)
    expect(readMcpConfig().servers.map((s) => s.name)).toEqual(['live'])
    expect(readMcpArchive().servers).toEqual([])
  })

  it('does not duplicate a name that is already active', () => {
    const m = mcp()
    writeMcpConfig({ servers: [stdio('a')] })
    m.archiveServer('a')
    m.activateAll()
    // The definition is active again; archive it and restore once more.
    m.archiveServer('a')
    expect(m.activateAll()).toBe(1)
    const names = readMcpConfig().servers.map((s) => s.name)
    expect(names.filter((n) => n === 'a').length).toBe(1)
  })
})
