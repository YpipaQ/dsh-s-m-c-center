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
import { SkillsManager } from '../src/features/skills/index.ts'
import { storeSkillsDir } from '../src/shared/paths.ts'
import { compactStoreIndex, writeStoreIndex } from '../src/features/skills/store-index.ts'
import { enableBlocker } from '../src/features/skills/scanner.ts'
import type { StoreEntry } from '../src/shared/protocol/index.ts'

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

    skills.deleteStored('alpha')
    expect(existsSync(join(userSkills(), 'alpha'))).toBe(false)
    expect(existsSync(join(store(), 'alpha'))).toBe(false)
    expect(skills.readStoreIndex().entries.map((e) => e.slug)).toEqual(['beta'])
    // Neighbours are untouched.
    expect(existsSync(join(store(), 'beta', 'SKILL.md'))).toBe(true)
  })

  it('deletes an unlinked stored skill', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    skills.unlinkSkill('alpha')

    expect(skills.deleteStored('alpha')).toBe(join(store(), 'alpha'))
    expect(existsSync(join(store(), 'alpha'))).toBe(false)
    expect(skills.readStoreIndex().entries).toEqual([])
  })

  it('refuses to delete anything that is not a stored skill', () => {
    const skills = new SkillsManager()
    const alpha = bundle(userSkills(), 'alpha', 'alpha')
    const outside = bundle(join(home, 'incoming'), 'gamma', 'gamma')
    skills.registerExternal([{ sourcePath: outside, kind: 'bundle' }])

    // A native skill is the user's own file and a registered one lives in
    // someone else's directory: neither is the copy this plugin owns.
    expect(() => skills.deleteStored('alpha')).toThrow(/储存库/)
    expect(existsSync(join(alpha, 'SKILL.md'))).toBe(true)
    expect(() => skills.deleteStored('gamma')).toThrow(/储存库/)
    expect(existsSync(join(outside, 'SKILL.md'))).toBe(true)
    expect(skills.readRegistry().entries.some((e) => e.slug === 'gamma')).toBe(true)
  })

  it('refuses a slug that is not a bare name, and a directory that is not a skill', () => {
    const skills = new SkillsManager()
    expect(() => skills.deleteStored('')).toThrow(/不是有效的技能标识/)
    expect(() => skills.deleteStored('../outside')).toThrow(/不是有效的技能标识/)
    expect(() => skills.deleteStored('a/b')).toThrow(/不是有效的技能标识/)

    // A leftover directory in the store is not a skill, and must not be
    // removable through this door either.
    mkdirSync(join(store(), 'leftovers'), { recursive: true })
    writeFileSync(join(store(), 'leftovers', 'notes.txt'), 'not a skill', 'utf8')
    expect(() => skills.deleteStored('leftovers')).toThrow(/只能删除储存库/)
    expect(existsSync(join(store(), 'leftovers', 'notes.txt'))).toBe(true)
  })
})

describe('admission', () => {
  it('migrates a DESCRIPTION.md-only bundle from the row path', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'apple')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'DESCRIPTION.md'), '# Apple\n\nApple skills for macOS.\n', 'utf8')

    // The panel sends the row's path, which is the *document* — not the
    // directory. Stripping only `SKILL.md` (what this used to do) left the file
    // path intact and made every migration of one of these fail.
    const slug = skills.migrateToStore(join(dir, 'DESCRIPTION.md'), 'bundle', 'user-dsh')
    expect(slug).toBe('apple')
    expect(existsSync(join(store(), 'apple', 'DESCRIPTION.md'))).toBe(true)
    const entry = skills.readStoreIndex().entries.find((e) => e.slug === 'apple')
    // An unmigrate needs the directory, not the document.
    expect(entry?.origin).toBe(dir)
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

/**
 * The manifest's row shape.
 *
 * An earlier version kept a per-skill 公告 flag, a 启用 flag, a link flag and a
 * source id on every row. By the end none of them controlled anything (the 公告
 * switch was removed for exactly that reason) — but the file is user-visible,
 * and a dead key sitting next to real ones reads as a live one. So writes carry
 * the canonical shape only, and mount-time compaction cleans up what is already
 * there. The `linked` flag is the clearest proof they were never maintained: it
 * said `false` for skills that were linked at the time.
 */
describe('manifest shape', () => {
  /** Add the legacy keys to the first row, as an older version would have. */
  function dirty(): { migratedAt?: string; entries: Array<Record<string, unknown>> } {
    const file = join(store(), 'index.json')
    const raw = JSON.parse(readFileSync(file, 'utf8')) as {
      migratedAt?: string
      entries: Array<Record<string, unknown>>
    }
    Object.assign(raw.entries[0], {
      source: 'user-dsh', enabled: false, linked: false, announce: true,
    })
    writeFileSync(file, JSON.stringify(raw, null, 2), 'utf8')
    return raw
  }

  it('drops the keys an older version wrote, keeping the fields that matter', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    const before = dirty()

    const result = compactStoreIndex()

    expect(result.changed).toBe(true)
    expect(result.dropped.sort()).toEqual(['announce', 'enabled', 'linked', 'source'])
    const after = JSON.parse(readFileSync(join(store(), 'index.json'), 'utf8'))
    expect(Object.keys(after.entries[0]).sort()).toEqual(['adoptedAt', 'name', 'origin', 'slug'])
    expect(after.entries[0].slug).toBe('alpha')
    expect(after.entries[0].origin).toBe(before.entries[0].origin)
    // The one-shot migration marker gates migrate(), so it must survive.
    expect(after.migratedAt).toBe(before.migratedAt)
  })

  it('is a no-op once the file is canonical', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()
    dirty()
    expect(compactStoreIndex().changed).toBe(true)

    expect(compactStoreIndex()).toEqual({ changed: false, dropped: [] })
  })

  it('never writes those keys back', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    skills.migrate()

    writeStoreIndex({
      version: 1,
      entries: [{
        slug: 'alpha', name: 'alpha', origin: 'x', adoptedAt: 'now',
        announce: true, linked: true,
      } as unknown as StoreEntry],
    })

    const row = JSON.parse(readFileSync(join(store(), 'index.json'), 'utf8')).entries[0]
    expect(Object.keys(row).sort()).toEqual(['adoptedAt', 'name', 'origin', 'slug'])
  })
})

/**
 * Container detection, measured against real files.
 *
 * `enableBlocker` exists so a flip on a container directory — one admitted by
 * DESCRIPTION.md alone, with no body to load — is refused instead of putting a
 * dead line in the model's catalog. Its only previous coverage stubbed the
 * function itself, so a case-mismatch in the scanner (uppercasing a file name
 * before comparing it to `DESCRIPTION.md`, which can never match) went
 * unnoticed and the refusal never fired once.
 */
describe('container detection', () => {
  /** A directory that admits by DESCRIPTION.md alone. */
  function container(root: string, dir: string, name: string): string {
    const path = join(root, dir)
    mkdirSync(path, { recursive: true })
    writeFileSync(join(path, 'DESCRIPTION.md'), [
      '---', `name: ${name}`, 'description: a container row', '---', '', 'children live one level down',
    ].join('\n'), 'utf8')
    return path
  }

  it('refuses a container and lets a real skill through', () => {
    const skills = new SkillsManager()
    bundle(userSkills(), 'alpha', 'alpha')
    container(userSkills(), 'apple', 'apple')
    skills.migrate()

    expect(enableBlocker('apple')).toContain('容器目录')
    expect(enableBlocker('alpha')).toBeUndefined()
    // An unknown slug is not a blocker: the route's own identity checks own that.
    expect(enableBlocker('nope')).toBeUndefined()
  })

  it('still resolves a container as a registration — listing and loading differ', () => {
    const skills = new SkillsManager()
    container(userSkills(), 'apple', 'apple')
    skills.migrate()

    // Refusing the *flip* must not make the row unresolvable: the panel lists
    // it, and its description is what tells a reader where the real skills are.
    expect(skills.resolveRegistration('apple')?.description).toBe('a container row')
  })
})
