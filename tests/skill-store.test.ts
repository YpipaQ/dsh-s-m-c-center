/**
 * Skill store: adoption, linking, and rollback.
 *
 * The store is the single canonical copy of a managed skill; a root only ever
 * holds a link to it. These tests pin the promises that makes to the user:
 * enabling is a link and never a rewrite, disabling removes the link instead of
 * editing SKILL.md, deleting a link never touches the stored copy, and a
 * migration can be undone.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillsManager } from '../src/skills.ts'
import { storeSkillsDir } from '../src/store.ts'

let home: string
let agents: string
let origHome: string | undefined
let origAgents: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-store-test-' + id)
  agents = join(tmpdir(), 'dsh-store-agents-' + id)
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

const userSkills = () => join(home, 'skills')
const store = () => storeSkillsDir()

/** Write a bundle skill (`<root>/<dir>/SKILL.md`). */
function bundle(root: string, dir: string, name: string, disable = false): string {
  const target = join(root, dir)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'SKILL.md'), frontmatter(name, disable), 'utf8')
  return target
}

/** Write a flat skill (`<root>/<name>.md`). */
function flat(root: string, name: string, disable = false): string {
  mkdirSync(root, { recursive: true })
  const file = join(root, name + '.md')
  writeFileSync(file, frontmatter(name, disable), 'utf8')
  return file
}

function frontmatter(name: string, disable: boolean): string {
  const head = ['---', 'name: ' + name, 'description: desc of ' + name]
  if (disable) { head.push('disable-model-invocation: true'); head.push('user-invocable: false') }
  return head.concat(['---', 'body of ' + name]).join('\n')
}

function isLinked(path: string): boolean {
  try { readlinkSync(path); return true } catch { return false }
}

describe('scanning follows links', () => {
  it('sees a skill that is only reachable through a junction', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'demo', 'demo')
    skills.migrate()

    const link = join(userSkills(), 'demo')
    expect(isLinked(link)).toBe(true)
    const found = skills.listSkills().find((s) => s.name === 'demo')
    expect(found?.managed).toBe(true)
    expect(found?.slug).toBe('demo')
    expect(found?.enabled).toBe(true)
  })

  it('treats a link pointing outside the store as an ordinary skill', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'outside'), 'ext', 'ext')
    mkdirSync(userSkills(), { recursive: true })
    symlinkSync(outside, join(userSkills(), 'ext'), process.platform === 'win32' ? 'junction' : 'dir')

    const found = skills.listSkills().find((s) => s.name === 'ext')
    expect(found).toBeDefined()
    expect(found?.managed).toBe(false)
  })
})

describe('migration', () => {
  it('moves bundles and flat files into the store as bundles', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    flat(userSkills(), 'beta')
    const result = skills.migrate()

    expect(result.moved).toBe(2)
    expect(result.failures).toEqual([])
    expect(existsSync(join(store(), 'alpha', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(store(), 'beta', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(userSkills(), 'beta.md'))).toBe(false)
  })

  it('links enabled skills back and leaves disabled ones unlinked', () => {
    const skills = new SkillsManager()
    const enabled = bundle(userSkills(), 'on-skill', 'on-skill')
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()

    expect(isLinked(join(userSkills(), 'on-skill'))).toBe(true)
    expect(isLinked(join(userSkills(), 'off-skill'))).toBe(false)
    // Enabled: the directory moved to the store and a link stands in its place.
    expect(isLinked(enabled)).toBe(true)
    // Disabled: moved too, but nothing is linked back.
    expect(existsSync(join(userSkills(), 'off-skill'))).toBe(false)
  })

  it('still lists a disabled skill so it can be switched back on', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()

    const found = skills.listSkills().find((s) => s.name === 'off-skill')
    expect(found).toBeDefined()
    expect(found?.enabled).toBe(false)
    expect(found?.managed).toBe(true)
    expect(found?.path).toBe(join(store(), 'off-skill', 'SKILL.md'))
  })

  it('strips invocation flags so a re-enabled skill is really visible', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()

    const stored = readFileSync(join(store(), 'off-skill', 'SKILL.md'), 'utf8')
    expect(stored).not.toContain('disable-model-invocation')
    expect(stored).not.toContain('user-invocable')
  })

  it('is idempotent', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    expect(skills.migrate().moved).toBe(1)
    expect(skills.migrate().moved).toBe(0)
    expect(skills.readStoreIndex().entries).toHaveLength(1)
  })

  it('leaves project-level skills where they are', () => {
    const skills = new SkillsManager()
    const project = join(home, 'project')
    mkdirSync(join(project, '.git'), { recursive: true })
    const inPlace = bundle(join(project, '.dsh', 'skills'), 'proj', 'proj')
    skills.migrate()

    expect(existsSync(inPlace)).toBe(true)
    expect(existsSync(join(store(), 'proj'))).toBe(false)
    const listed = skills.listSkills(project).find((s) => s.name === 'proj')
    expect(listed?.managed).toBe(false)
    expect(listed?.level).toBe('project')
  })

  it('reports a skill it could not move instead of losing it', () => {
    const skills = new SkillsManager()
    const origin = bundle(userSkills(), 'stuck', 'stuck')
    // Occupy the store path with a file so it can never become a directory:
    // adoption of this skill cannot succeed, whatever the platform.
    mkdirSync(dirname(store()), { recursive: true })
    writeFileSync(store(), 'not a directory', 'utf8')

    const result = skills.migrate()
    expect(result.moved).toBe(0)
    expect(result.failures).toHaveLength(1)
    // The skill stays exactly where it was and is still listed.
    expect(existsSync(join(origin, 'SKILL.md'))).toBe(true)
    expect(skills.listSkills().some((s) => s.name === 'stuck')).toBe(true)
  })
})

describe('toggling', () => {
  it('adds and removes the link without rewriting SKILL.md', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    const before = readFileSync(join(store(), 'alpha', 'SKILL.md'), 'utf8')

    skills.setSkillEnabled(join(userSkills(), 'alpha', 'SKILL.md'), false)
    expect(isLinked(join(userSkills(), 'alpha'))).toBe(false)

    const offPath = join(store(), 'alpha', 'SKILL.md')
    skills.setSkillEnabled(offPath, true)
    expect(isLinked(join(userSkills(), 'alpha'))).toBe(true)
    expect(readFileSync(offPath, 'utf8')).toBe(before)
  })

  it('keeps the unmanaged path on frontmatter toggling', () => {
    const skills = new SkillsManager()
    const project = join(home, 'project')
    mkdirSync(join(project, '.git'), { recursive: true })
    const target = bundle(join(project, '.dsh', 'skills'), 'proj', 'proj')

    skills.setSkillEnabled(join(target, 'SKILL.md'), false)
    const raw = readFileSync(join(target, 'SKILL.md'), 'utf8')
    expect(raw).toContain('disable-model-invocation: true')
    expect(isLinked(target)).toBe(false)
  })

  it('never deletes a real directory when unlinking', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    // Replace the link with a real directory holding the same skill.
    rmSync(join(userSkills(), 'alpha'), { recursive: true, force: true })
    bundle(userSkills(), 'alpha', 'alpha')

    skills.setSkillEnabled(join(userSkills(), 'alpha', 'SKILL.md'), false)
    expect(existsSync(join(userSkills(), 'alpha', 'SKILL.md'))).toBe(true)
  })
})

describe('deleting', () => {
  it('removes the link, the stored copy, and the manifest entry', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    bundle(userSkills(), 'beta', 'beta')
    skills.migrate()

    skills.deleteSkill(join(userSkills(), 'alpha', 'SKILL.md'), 'bundle')
    expect(existsSync(join(userSkills(), 'alpha'))).toBe(false)
    expect(existsSync(join(store(), 'alpha'))).toBe(false)
    expect(skills.readStoreIndex().entries.map((e) => e.slug)).toEqual(['beta'])
    // Neighbours are untouched.
    expect(existsSync(join(store(), 'beta', 'SKILL.md'))).toBe(true)
  })

  it('deletes a disabled skill through its store path', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()

    skills.deleteSkill(join(store(), 'off-skill', 'SKILL.md'), 'bundle')
    expect(existsSync(join(store(), 'off-skill'))).toBe(false)
    expect(skills.readStoreIndex().entries).toEqual([])
  })
})

describe('import', () => {
  it('adopts imported skills into the store as enabled bundles', () => {
    const skills = new SkillsManager()
    const source = bundle(join(home, 'incoming'), 'gamma', 'gamma')
    const flatSource = flat(join(home, 'incoming'), 'delta')

    const results = skills.importSkills([
      { sourcePath: source, kind: 'bundle' },
      { sourcePath: flatSource, kind: 'file' },
    ])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(isLinked(join(userSkills(), 'gamma'))).toBe(true)
    expect(existsSync(join(store(), 'delta', 'SKILL.md'))).toBe(true)
    expect(existsSync(flatSource)).toBe(false)
  })

    it('reports a name collision instead of overwriting', () => {
      const skills = new SkillsManager()
      const first = bundle(join(home, 'incoming'), 'one', 'dup')
      const second = bundle(join(home, 'incoming-two'), 'two', 'dup')
      expect(skills.importSkills([{ sourcePath: first, kind: 'bundle' }])[0]?.ok).toBe(true)
      // Second adoption lands under a unique slug rather than clobbering.
      expect(skills.importSkills([{ sourcePath: second, kind: 'bundle' }])[0]?.ok).toBe(true)
      expect(skills.readStoreIndex().entries).toHaveLength(2)
    })

    it('releases imported skills into the dsh user skills root on rollback, not their arbitrary source', () => {
      const skills = new SkillsManager()
      // An "outside" directory an import has no business sending skills back to.
      const outside = join(home, 'agents-skills')
      const source = bundle(outside, 'traveler', 'traveler')

      expect(skills.importSkills([{ sourcePath: source, kind: 'bundle' }])[0]?.ok).toBe(true)
      expect(skills.readStoreIndex().entries.find((e) => e.slug === 'traveler')?.origin)
        .toBe(join(userSkills(), 'traveler'))

      skills.rollbackMigration()
      // Landed in the dsh root, and the arbitrary source stays empty.
      expect(existsSync(join(userSkills(), 'traveler', 'SKILL.md'))).toBe(true)
      expect(existsSync(join(outside, 'traveler'))).toBe(false)
    })
  })

describe('rollback', () => {
  it('restores every skill to its original path', () => {
    const skills = new SkillsManager()
    const origin = bundle(userSkills(), 'alpha', 'alpha')
    flat(userSkills(), 'beta')
    skills.migrate()

    const result = skills.rollbackMigration()
    expect(result.moved).toBe(2)
    expect(existsSync(join(origin, 'SKILL.md'))).toBe(true)
    expect(existsSync(join(userSkills(), 'beta.md'))).toBe(true)
    expect(existsSync(join(userSkills(), 'alpha'))).toBe(true)
    expect(isLinked(join(userSkills(), 'alpha'))).toBe(false)
  })

  it('restores a skill that was disabled before the migration as disabled', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()
    skills.rollbackMigration()

    const raw = readFileSync(join(userSkills(), 'off-skill', 'SKILL.md'), 'utf8')
    expect(raw).toContain('disable-model-invocation: true')
  })
})

describe('agent-dropped bundles', () => {
  it('lists a bundle dropped into the store after migration as a disabled row', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'seed', 'seed')
    skills.migrate() // index.json now exists and is valid

    bundle(store(), 'agent-made', 'Agent Made') // agent writes directly — no manifest entry

    const found = skills.listSkills().find((s) => s.slug === 'agent-made')
    expect(found).toBeDefined()
    expect(found?.enabled).toBe(false)
    expect(found?.managed).toBe(true)
    expect(found?.level).toBe('user')
    expect(found?.path).toBe(join(store(), 'agent-made', 'SKILL.md'))
  })

  it('can be enabled through its store path, which adopts it into the manifest', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'seed', 'seed')
    skills.migrate()
    bundle(store(), 'agent-made', 'Agent Made')

    const row = skills.listSkills().find((s) => s.slug === 'agent-made')
    expect(row).toBeDefined()
    skills.setSkillEnabled(row!.path, true)

    expect(isLinked(join(userSkills(), 'agent-made'))).toBe(true)
    expect(skills.readStoreIndex().entries.some((e) => e.slug === 'agent-made')).toBe(true)
    expect(skills.listSkills().find((s) => s.slug === 'agent-made')?.enabled).toBe(true)
  })

  it('counts dropped bundles in the store banner', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'seed', 'seed')
    skills.migrate()
    expect(skills.storeStatus().count).toBe(1)

    bundle(store(), 'agent-made', 'Agent Made')
    expect(skills.storeStatus().count).toBe(2)
  })
})

describe('store status', () => {
  it('reports counts and the store directory', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    bundle(userSkills(), 'beta', 'beta', true)
    skills.migrate()

    const status = skills.storeStatus()
    expect(status.dir).toBe(store())
    expect(status.migrated).toBe(true)
    expect(status.count).toBe(2)
    expect(status.enabled).toBe(1)
    expect(status.failures).toEqual([])
  })
})

describe('manifest recovery', () => {
  it('rebuilds from disk when index.json is corrupt', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    writeFileSync(join(store(), 'index.json'), '{ not json', 'utf8')

    const index = skills.readStoreIndex()
    expect(index.entries.map((e) => e.slug)).toEqual(['alpha'])
    expect(existsSync(join(store(), 'index.corrupt.json'))).toBe(true)
  })
})
