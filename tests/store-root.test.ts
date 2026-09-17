/**
 * The unified store root (`~/.dsh/S-M-C`) and the migration into it.
 *
 * The move itself is boring; what matters is the link repair. A junction stores
 * an absolute target, so relocating the store silently orphans every link into
 * it — the bundles survive but the agent stops seeing them, which is a far
 * worse failure than a crash because nothing looks broken. These tests pin that
 * repair, plus the two things that make the migration safe to run repeatedly:
 * it is idempotent, and it does nothing at all on a fresh machine.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { migrateStoreRoot } from '../src/migrate.ts'
import { cliConfigPath } from '../src/cli.ts'
import { mcpArchivePath, mcpConfigPath } from '../src/mcp.ts'
import { SkillsManager } from '../src/skills.ts'
import {
  dshHomeDir, storeCliPath, storeMcpArchivePath, storeMcpPath, storeRoot,
  storeSkillsDir,
} from '../src/store.ts'

let home: string
let agents: string
let origHome: string | undefined
let origAgents: string | undefined
let origRoot: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-smc-home-' + id)
  agents = join(tmpdir(), 'dsh-smc-agents-' + id)
  mkdirSync(home, { recursive: true })
  mkdirSync(agents, { recursive: true })
  origHome = process.env.DSH_HOME
  origAgents = process.env.DSH_AGENTS_HOME
  origRoot = process.env.DSH_STORE_ROOT
  process.env.DSH_HOME = home
  process.env.DSH_AGENTS_HOME = agents
  delete process.env.DSH_STORE_ROOT
})

afterEach(() => {
  for (const [key, value] of [
    ['DSH_HOME', origHome], ['DSH_AGENTS_HOME', origAgents], ['DSH_STORE_ROOT', origRoot],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(home, { recursive: true, force: true })
  rmSync(agents, { recursive: true, force: true })
})

const userSkills = () => join(home, 'skills')
const oldStore = () => join(home, 'skills-store')
const LINK = process.platform === 'win32' ? 'junction' : 'dir'

/** A minimal skill bundle. */
function bundle(dir: string, name: string): string {
  const target = join(dir, name)
  mkdirSync(target, { recursive: true })
  writeFileSync(
    join(target, 'SKILL.md'),
    ['---', 'name: ' + name, 'description: desc of ' + name, '---', 'body'].join('\n'),
    'utf8',
  )
  return target
}

/** A legacy store manifest, as an older build would have left it. */
function manifest(slug: string, enabled: boolean): void {
  writeFileSync(join(oldStore(), 'index.json'), JSON.stringify({
    version: 1,
    entries: [{
      slug, name: slug, origin: join(userSkills(), slug),
      source: 'user-dsh', enabled, adoptedAt: '2026-09-11T00:00:00.000Z',
    }],
  }), 'utf8')
}

/** True when `path` is a symlink or junction (works even when dangling). */
function isLinked(path: string): boolean {
  try { readlinkSync(path); return true } catch { return false }
}

describe('store root resolution', () => {
  it('sits under $DSH_HOME by default', () => {
    expect(storeRoot()).toBe(join(home, 'S-M-C'))
    expect(storeSkillsDir()).toBe(join(home, 'S-M-C', 'skills'))
    expect(storeMcpPath()).toBe(join(home, 'S-M-C', 'mcp.json'))
    expect(storeMcpArchivePath()).toBe(join(home, 'S-M-C', 'mcp-archive.json'))
    expect(storeCliPath()).toBe(join(home, 'S-M-C', 'cli.json'))
  })

  it('honours $DSH_STORE_ROOT so the store can leave the dsh home', () => {
    process.env.DSH_STORE_ROOT = join(home, 'elsewhere', 'store')
    expect(storeRoot()).toBe(join(home, 'elsewhere', 'store'))
    expect(storeSkillsDir()).toBe(join(home, 'elsewhere', 'store', 'skills'))
  })

  it('resolves a relative $DSH_STORE_ROOT against the cwd', () => {
    process.env.DSH_STORE_ROOT = 'relative-store'
    expect(storeRoot()).toBe(resolve('relative-store'))
  })

  it('ignores an empty $DSH_STORE_ROOT rather than writing to the cwd', () => {
    process.env.DSH_STORE_ROOT = '   '
    expect(storeRoot()).toBe(join(home, 'S-M-C'))
    expect(storeRoot()).toBe(join(dshHomeDir(), 'S-M-C'))
  })
})

describe('migrateStoreRoot', () => {
  it('does nothing but create the root on a fresh machine', () => {
    const result = migrateStoreRoot(new SkillsManager())
    expect(result.moved).toEqual([])
    expect(result.failures).toEqual([])
    expect(existsSync(storeRoot())).toBe(true)
  })

  it('moves the legacy skills-store into S-M-C/skills', () => {
    bundle(oldStore(), 'alpha')
    manifest('alpha', true)

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.moved).toContain('skills-store/')
    expect(existsSync(join(storeSkillsDir(), 'alpha', 'SKILL.md'))).toBe(true)
    expect(existsSync(oldStore())).toBe(false)
  })

  it('moves the three legacy documents into S-M-C', () => {
    writeFileSync(join(home, 'mcp.json'), '{"servers":[{"name":"a"}]}', 'utf8')
    writeFileSync(join(home, 'mcp-archive.json'), '{"version":1,"servers":[]}', 'utf8')
    writeFileSync(join(home, 'cli.json'), '{"entries":[]}', 'utf8')

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.moved).toContain('mcp.json')
    expect(result.moved).toContain('mcp-archive.json')
    expect(result.moved).toContain('cli.json')
    expect(existsSync(join(home, 'mcp.json'))).toBe(false)
    expect(readFileSync(mcpConfigPath(), 'utf8')).toContain('"a"')
    // The managers must now read the new location.
    expect(mcpConfigPath()).toBe(storeMcpPath())
    expect(mcpArchivePath()).toBe(storeMcpArchivePath())
    expect(cliConfigPath()).toBe(storeCliPath())
  })

  it('repoints a link that still names the old store', () => {
    bundle(oldStore(), 'alpha')
    manifest('alpha', true)
    const link = join(userSkills(), 'alpha')
    mkdirSync(userSkills(), { recursive: true })
    symlinkSync(join(oldStore(), 'alpha'), link, LINK)

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.relinked).toBe(1)
    expect(resolve(readlinkSync(link))).toBe(resolve(join(storeSkillsDir(), 'alpha')))
    // And the skill is still visible through the link, which is the whole point.
    const found = new SkillsManager().listSkills().find((s) => s.name === 'alpha')
    expect(found?.group).toBe('stored')
    expect(found?.linked).toBe(true)
  })

  it('leaves links that point somewhere else alone', () => {
    const outside = bundle(join(home, 'outside'), 'ext')
    mkdirSync(userSkills(), { recursive: true })
    symlinkSync(outside, join(userSkills(), 'ext'), LINK)
    bundle(oldStore(), 'alpha')

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.relinked).toBe(0)
    expect(resolve(readlinkSync(join(userSkills(), 'ext')))).toBe(resolve(outside))
  })

  it('is idempotent — a second pass has nothing left to move', () => {
    bundle(oldStore(), 'alpha')
    writeFileSync(join(home, 'cli.json'), '{"entries":[]}', 'utf8')
    const skills = new SkillsManager()

    migrateStoreRoot(skills)
    const second = migrateStoreRoot(skills)

    expect(second.moved).toEqual([])
    expect(second.relinked).toBe(0)
    expect(second.failures).toEqual([])
    expect(existsSync(join(storeSkillsDir(), 'alpha', 'SKILL.md'))).toBe(true)
  })

  it('carries a real skill through the whole upgrade path', () => {
    // Start from the pre-store layout: an ordinary directory in ~/.dsh/skills.
    bundle(userSkills(), 'gsap')
    const skills = new SkillsManager()
    skills.migrate() // → 0.3/0.4: canonical copy in skills-store, link back
    expect(isLinked(join(userSkills(), 'gsap'))).toBe(true)

    migrateStoreRoot(skills) // → 0.5: S-M-C/skills, link repaired

    expect(existsSync(join(storeSkillsDir(), 'gsap', 'SKILL.md'))).toBe(true)
    expect(existsSync(oldStore())).toBe(false)
    expect(resolve(readlinkSync(join(userSkills(), 'gsap'))))
      .toBe(resolve(join(storeSkillsDir(), 'gsap')))
    // The agent still sees it, which is the only thing that actually matters.
    const found = skills.listSkills().find((s) => s.name === 'gsap')
    expect(found?.group).toBe('stored')
    expect(found?.linked).toBe(true)
  })

  it('reports a store it could not move instead of throwing', () => {
    // A *file* where the store root must go: no directory can be created
    // there, so every move below is impossible from the start.
    writeFileSync(join(home, 'S-M-C'), 'in the way', 'utf8')
    bundle(oldStore(), 'alpha')

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.failures.length).toBeGreaterThan(0)
    expect(result.failures[0].path).toBe(storeRoot())
    // The legacy copy is left in place rather than lost.
    expect(existsSync(join(oldStore(), 'alpha', 'SKILL.md'))).toBe(true)
    expect(result.moved).toEqual([])
  })

  it('keeps working when the store root is relocated out of $DSH_HOME', () => {
    const elsewhere = join(home, 'elsewhere', 'store')
    process.env.DSH_STORE_ROOT = elsewhere
    bundle(oldStore(), 'alpha')

    const result = migrateStoreRoot(new SkillsManager())

    expect(result.moved).toContain('skills-store/')
    expect(existsSync(join(elsewhere, 'skills', 'alpha', 'SKILL.md'))).toBe(true)
  })
})
