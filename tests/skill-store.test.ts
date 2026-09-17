/**
 * Skill store: the four-group model.
 *
 * 1. native — real files in a scanned root (migrate-to-store moves them);
 * 2. stored — canonical copies in `~/.dsh/S-M-C/skills` (index.json manifest);
 * 3. registered — external skills whose copies stay put (skills-registry.json);
 * 4. links — junctions under `~/.dsh/skills`, every one recorded in
 *    skills-links.json.
 *
 * These tests pin the promises that model makes to the user: SKILL.md files
 * are never rewritten, links are always recorded, undoing a migration removes
 * the link along with the store copy, and a link without a ledger record is a
 * red flag with verify/delete instead of silent adoption.
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
function flat(root: string, name: string): string {
  mkdirSync(root, { recursive: true })
  const file = join(root, name + '.md')
  writeFileSync(file, frontmatter(name, false), 'utf8')
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
    expect(found?.group).toBe('stored')
    expect(found?.slug).toBe('demo')
    expect(found?.linked).toBe(true)
  })

  it('flags a link pointing outside every ledger as untracked', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'outside'), 'ext', 'ext')
    mkdirSync(userSkills(), { recursive: true })
    symlinkSync(outside, join(userSkills(), 'ext'), process.platform === 'win32' ? 'junction' : 'dir')

    const found = skills.listSkills().find((s) => s.name === 'ext')
    expect(found).toBeDefined()
    expect(found?.linked).toBe(true)
    expect(found?.untracked).toBe(true)
  })
})

describe('migration (native → stored)', () => {
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

  it('links every migrated skill back from ~/.dsh/skills', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    bundle(userSkills(), 'off-skill', 'off-skill', true)
    skills.migrate()

    expect(isLinked(join(userSkills(), 'alpha'))).toBe(true)
    expect(isLinked(join(userSkills(), 'off-skill'))).toBe(true)
    // The SKILL.md is copied verbatim — the disable flag stays as written.
    expect(readFileSync(join(store(), 'off-skill', 'SKILL.md'), 'utf8'))
      .toContain('disable-model-invocation: true')
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
    expect(listed?.group).toBe('native')
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

describe('the four groups (operations)', () => {
  it('migrateToStore adopts a native skill: copy + link + manifest, registry dropped', () => {
    const skills = new SkillsManager()
    const dir = bundle(userSkills(), 'alpha', 'alpha')
    // The scan auto-registers the native skill first.
    expect(skills.listSkills().find((s) => s.name === 'alpha')?.group).toBe('native')

    skills.migrateToStore(dir, 'bundle', 'user-dsh')

    expect(existsSync(join(store(), 'alpha', 'SKILL.md'))).toBe(true)
    // The original location now holds the link (existsSync follows it).
    expect(isLinked(dir)).toBe(true)
    const entry = skills.readStoreIndex().entries.find((e) => e.slug === 'alpha')
    expect(entry?.origin).toBe(dir)
    const row = skills.listSkills().find((s) => s.slug === 'alpha')
    expect(row?.group).toBe('stored')
    expect(row?.linked).toBe(true)
  })

  it('unmigrate removes the link and the store copy, restoring the origin', () => {
    const skills = new SkillsManager()
    const dir = bundle(userSkills(), 'alpha', 'alpha')
    skills.migrateToStore(dir, 'bundle', 'user-dsh')

    skills.unmigrate('alpha')

    expect(isLinked(join(userSkills(), 'alpha'))).toBe(false)
    expect(existsSync(join(store(), 'alpha'))).toBe(false)
    expect(existsSync(join(dir, 'SKILL.md'))).toBe(true)
    expect(skills.readStoreIndex().entries.some((e) => e.slug === 'alpha')).toBe(false)
  })

  it('unmigrate refuses a skill without an origin instead of losing it', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'seed', 'seed')
    skills.migrate()
    bundle(store(), 'dropped', 'dropped') // no manifest entry → no origin
    skills.listSkills() // adopts it into the manifest with origin: ''
    expect(() => skills.unmigrate('dropped')).toThrow(/原始路径/)
  })

  it('linkSkill/unlinkSkill write and remove the ledger record', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    skills.unlinkSkill('alpha')
    expect(isLinked(join(userSkills(), 'alpha'))).toBe(false)
    const row = skills.listSkills().find((s) => s.slug === 'alpha')
    expect(row?.linked).toBe(false)

    skills.linkSkill('alpha')
    expect(isLinked(join(userSkills(), 'alpha'))).toBe(true)
    expect(skills.listSkills().find((s) => s.slug === 'alpha')?.linked).toBe(true)
    // The ledger knows about it.
    expect(skills.readLinks().links.some((l) => l.slug === 'alpha')).toBe(true)
    // And the SKILL.md was never touched.
    expect(readFileSync(join(store(), 'alpha', 'SKILL.md'), 'utf8')).toContain('body of alpha')
  })

  it('never deletes a real directory when unlinking', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    // Replace the link with a real directory holding the same skill.
    rmSync(join(userSkills(), 'alpha'), { recursive: true, force: true })
    bundle(userSkills(), 'alpha', 'alpha')

    // unlinkSkill is a no-op for a real directory — it never deletes one.
    skills.unlinkSkill('alpha')
    expect(existsSync(join(userSkills(), 'alpha', 'SKILL.md'))).toBe(true)
    // The stale ledger record is dropped: the link no longer exists.
    expect(skills.readLinks().links.some((l) => l.slug === 'alpha')).toBe(false)
  })

  it('setAnnounce flips the flag in whichever ledger holds the skill', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    expect(skills.listSkills().find((s) => s.slug === 'alpha')?.announce).toBe(true)

    skills.setAnnounce('stored', 'alpha', false)
    expect(skills.readStoreIndex().entries.find((e) => e.slug === 'alpha')?.announce).toBe(false)
    expect(skills.listSkills().find((s) => s.slug === 'alpha')?.announce).toBe(false)
  })

  it('registered external skills keep their copy in place and link on demand', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'incoming'), 'gamma', 'gamma')
    const results = skills.registerExternal([{ sourcePath: outside, kind: 'bundle' }])
    expect(results[0]?.ok).toBe(true)
    // Nothing moved.
    expect(existsSync(join(outside, 'SKILL.md'))).toBe(true)
    expect(existsSync(join(store(), 'gamma'))).toBe(false)

    const row = skills.listSkills().find((s) => s.slug === 'gamma')
    expect(row?.group).toBe('registered')
    expect(row?.linked).toBe(false)

    // Link on demand: the link points at the external copy.
    skills.linkSkill('gamma')
    expect(isLinked(join(userSkills(), 'gamma'))).toBe(true)
    expect(skills.listSkills().find((s) => s.slug === 'gamma')?.linked).toBe(true)

    // Unregister drops the link and the record, leaving the copy alone.
    skills.unregisterExternal('gamma')
    expect(isLinked(join(userSkills(), 'gamma'))).toBe(false)
    expect(existsSync(join(outside, 'SKILL.md'))).toBe(true)
    expect(skills.readRegistry().entries.some((e) => e.slug === 'gamma')).toBe(false)
  })

  it('registerExternal de-duplicates slugs instead of clobbering', () => {
    const skills = new SkillsManager()
    const first = bundle(join(home, 'incoming'), 'one', 'dup')
    const second = bundle(join(home, 'incoming-two'), 'two', 'dup')
    expect(skills.registerExternal([{ sourcePath: first, kind: 'bundle' }])[0]?.ok).toBe(true)
    expect(skills.registerExternal([{ sourcePath: second, kind: 'bundle' }])[0]?.ok).toBe(true)
    const slugs = skills.readRegistry().entries.map((e) => e.slug).sort()
    expect(slugs[0]).not.toBe(slugs[1])
  })

  it('refreshRegistry only checks existence (traceability, no parsing)', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'incoming'), 'gamma', 'gamma')
    skills.registerExternal([{ sourcePath: outside, kind: 'bundle' }])

    let results = skills.refreshRegistry()
    expect(results[0]?.exists).toBe(true)

    rmSync(outside, { recursive: true, force: true })
    results = skills.refreshRegistry()
    expect(results[0]?.exists).toBe(false)
  })

  it('verifyLink reports target state; deleteUntrackedLink removes a red-flag link', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'outside'), 'ext', 'ext')
    mkdirSync(userSkills(), { recursive: true })
    symlinkSync(outside, join(userSkills(), 'ext'), process.platform === 'win32' ? 'junction' : 'dir')

    // Tracked check first: no ledger record → untracked, verify says so.
    const untracked = skills.verifyLink('ext')
    expect(untracked.ok).toBe(true)
    expect(untracked.tracked).toBe(false)

    // Deleting it works because the ledger does not claim it.
    skills.deleteUntrackedLink(join(userSkills(), 'ext'))
    expect(isLinked(join(userSkills(), 'ext'))).toBe(false)

    // A tracked link refuses deleteUntrackedLink (use unlink instead).
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrateToStore(join(userSkills(), 'alpha'), 'bundle', 'user-dsh')
    expect(() => skills.deleteUntrackedLink(join(userSkills(), 'alpha'))).toThrow(/账本/)
    const verified = skills.verifyLink('alpha')
    expect(verified.ok).toBe(true)
    expect(verified.tracked).toBe(true)
    expect(verified.stored).toBe(true)
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

  it('deletes an unlinked stored skill through its store path', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    skills.unlinkSkill('alpha')

    skills.deleteSkill(join(store(), 'alpha', 'SKILL.md'), 'bundle')
    expect(existsSync(join(store(), 'alpha'))).toBe(false)
    expect(skills.readStoreIndex().entries).toEqual([])
  })

  it('deleting a registered skill leaves the external copy alone', () => {
    const skills = new SkillsManager()
    const outside = bundle(join(home, 'incoming'), 'gamma', 'gamma')
    skills.registerExternal([{ sourcePath: outside, kind: 'bundle' }])
    skills.deleteSkill(join(outside, 'SKILL.md'), 'bundle')
    expect(existsSync(join(outside, 'SKILL.md'))).toBe(true)
    expect(skills.readRegistry().entries.some((e) => e.slug === 'gamma')).toBe(false)
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
})

describe('agent-dropped bundles', () => {
  it('adopts a bundle dropped into the store on the next listing', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'seed', 'seed')
    skills.migrate() // index.json now exists and is valid

    bundle(store(), 'agent-made', 'Agent Made') // agent writes directly — no manifest entry

    const found = skills.listSkills().find((s) => s.slug === 'agent-made')
    expect(found).toBeDefined()
    expect(found?.group).toBe('stored')
    expect(found?.announce).toBe(false)
    expect(found?.level).toBe('user')
    expect(found?.path).toBe(join(store(), 'agent-made', 'SKILL.md'))
    // Adopted into the manifest on sight.
    expect(skills.readStoreIndex().entries.some((e) => e.slug === 'agent-made')).toBe(true)
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
  it('reports counts, link state, and the store directory', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    bundle(userSkills(), 'beta', 'beta')
    skills.migrate()
    skills.unlinkSkill('beta')

    const status = skills.storeStatus()
    expect(status.dir).toBe(store())
    expect(status.migrated).toBe(true)
    expect(status.count).toBe(2)
    expect(status.linked).toBe(1)
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
