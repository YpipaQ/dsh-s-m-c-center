/**
 * Non-skill entries in a skill root, shown and flagged rather than skipped.
 *
 * dsh's own scanner reads exactly one level of a skill root, so a directory
 * that holds no admission document is not a skill as far as dsh is concerned,
 * and neither is anything buried inside it. This plugin used to walk straight
 * past such a directory: skills on disk, nothing in the list, and no hint that
 * anything was missing — the worst kind of failure.
 *
 * The replacement rule is deliberately narrow. The directory is *listed*, so the
 * user can see what sits in the root, and it is flagged `illegal` — red in the
 * panel, refused by `enableBlocker`. Nothing below it is listed, because dsh
 * cannot reach anything there either; claiming otherwise would promise a
 * reachability that does not exist.
 * @module
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillsManager } from '../src/features/skills/index.ts'
import { catalogEntriesOf } from '../src/features/skills/catalog.ts'
import { missingSlugs, withoutMissing } from '../src/features/context/tools.ts'
import { CliManager } from '../src/features/cli/index.ts'

let home: string
let agents: string
let origHome: string | undefined
let origAgents: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-irregular-' + id)
  agents = join(tmpdir(), 'dsh-irregular-agents-' + id)
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
const agentsSkills = () => join(agents, 'skills')

const skillDoc = (name: string) => `---\nname: ${name}\ndescription: ${name} does a thing\n---\nbody of ${name}`

/** Write `<root>/<category>/<skill>/SKILL.md` — the shape a bundled library ships in. */
function nested(root: string, category: string, skill: string): void {
  const dir = join(root, category, skill)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), skillDoc(skill), 'utf8')
}

describe('non-skill directories in a skill root', () => {
  it('does not list skills buried under a category directory', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'software-development', 'demo-github')
    nested(userSkills(), 'software-development', 'demo-dogfood')

    // dsh reads one level, so these are invisible to it; listing them would
    // promise a reachability this plugin cannot create. Only the directory
    // itself is shown.
    const rows = skills.listSkills()
    expect(rows.filter((r) => r.name.startsWith('demo-')).length).toBe(0)
  })

  it('flags the directory itself as illegal', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'software-development', 'demo-a')

    const row = skills.listSkills().find((r) => r.name === 'software-development')
    expect(row).toBeDefined()
    expect(row?.irregular).toBe('illegal')
    expect(row?.group).toBe('native')
    // Not a skill, so it must not claim to be linked or loadable.
    expect(row?.linked).toBe(false)
    expect(row?.slug).toBeDefined()
  })

  it('flags an empty directory the same way — there is one verdict, not two', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'demo-bare', 'demo-notes')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'README.md'), 'not a skill', 'utf8')

    const row = skills.listSkills().find((r) => r.name === 'demo-bare')
    expect(row?.irregular).toBe('illegal')
  })

  it('refuses to enable a flagged directory, and says it is not a valid skill', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'demo-category', 'demo-child')

    const category = skills.listSkills().find((r) => r.name === 'demo-category')
    const why = skills.enableBlocker(category?.slug ?? '')
    expect(why).toBeDefined()
    expect(why).toContain('不是合法技能')
  })

  it('refuses to resolve a flagged row: a description is not a body', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'demo-category', 'demo-child')
    const row = skills.listSkills().find((r) => r.name === 'demo-category')

    // `resolveRegistration` is the *loading* path — the context engine and
    // `skill_select` both call it. Returning an explanation here (as this once
    // did, so the panel could show one) let a non-skill be enabled into a
    // conversation and written into its selection file, where nothing would
    // ever clear it: the panel said "not loadable" while the model's catalog
    // listed it. The explanation belongs on the *detail* path instead.
    expect(skills.resolveRegistration(row?.slug ?? '')).toBeUndefined()
    // ...which is `readSkill` on the row's path — it answers with the reason
    // rather than throwing on a directory.
    const detail = skills.readSkill(row?.path ?? '')
    expect(detail?.content).toContain('不是技能')
  })

  it('keeps a flagged directory and a real skill of the same name apart', () => {
    const skills = new SkillsManager()
    // A directory named `demo-tools` that is not a skill, and a real skill that
    // also calls itself demo-tools: only one of them can be loaded, so they must
    // not share a slug.
    mkdirSync(join(userSkills(), 'demo-tools'), { recursive: true })
    const real = join(userSkills(), 'demo-real')
    mkdirSync(real, { recursive: true })
    writeFileSync(join(real, 'SKILL.md'), skillDoc('demo-tools'), 'utf8')

    const rows = skills.listSkills()
    const dirRow = rows.find((r) => r.name === 'demo-tools' && r.irregular !== undefined)
    const skillRow = rows.find((r) => r.name === 'demo-tools' && r.irregular === undefined)
    expect(dirRow?.slug).not.toBe(skillRow?.slug)
    expect(skills.enableBlocker(skillRow?.slug ?? '')).toBeUndefined()
    expect(skills.enableBlocker(dirRow?.slug ?? '')).toBeDefined()
  })

  it('does not descend at any depth', () => {
    const skills = new SkillsManager()
    const deep = join(userSkills(), 'demo-a', 'demo-b', 'demo-c')
    mkdirSync(deep, { recursive: true })
    writeFileSync(join(deep, 'SKILL.md'), skillDoc('demo-too-deep'), 'utf8')

    const rows = skills.listSkills()
    expect(rows.find((r) => r.name === 'demo-a')?.irregular).toBe('illegal')
    expect(rows.find((r) => r.name === 'demo-too-deep')).toBeUndefined()
    // One level down is not listed either — there is no partial descent.
    expect(rows.find((r) => r.name === 'demo-b')).toBeUndefined()
  })

  it('leaves ordinary root-level skills exactly as they were', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'demo-plain')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), skillDoc('demo-plain'), 'utf8')

    const row = skills.listSkills().find((r) => r.name === 'demo-plain')
    expect(row).toBeDefined()
    expect(row?.irregular).toBeUndefined()
    expect(row?.slug).toBe('demo-plain')
    expect(row?.path).toBe(join(dir, 'SKILL.md'))
  })

  it('keeps DESCRIPTION.md containers out of the illegal path', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'demo-desc')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'DESCRIPTION.md'), '# 容器说明\n\n本组技能的说明。', 'utf8')

    // A DESCRIPTION.md-only bundle is a *regular* skill (its body is the
    // admission), so it must never be reported as an illegal entry.
    const row = skills.listSkills().find((r) => r.name === 'demo-desc')
    expect(row).toBeDefined()
    expect(row?.irregular).toBeUndefined()
    expect(row?.description).toBe('容器说明')
  })

  it('cannot be enabled into a conversation, however the slug got there', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'demo-category', 'demo-child')
    const dirSlug = skills.listSkills().find((r) => r.irregular === 'illegal')?.slug ?? ''

    // The loading path refuses it...
    expect(skills.resolveRegistration(dirSlug)).toBeUndefined()
    // ...so the select pipeline reports it missing, and `withoutMissing` drops
    // it before anything reaches the conversation's selection file.
    const kept = withoutMissing(
      { sessionId: 's', selected: [dirSlug], updatedAt: '' } as never,
      missingSlugs(skills, { sessionId: 's', selected: [dirSlug], updatedAt: '' } as never),
    )
    expect(kept.selected).toEqual([])
  })

  it('stays out of the shadow catalog even if the selection names it', () => {
    const skills = new SkillsManager()
    nested(userSkills(), 'demo-category', 'demo-child')
    const dirSlug = skills.listSkills().find((r) => r.irregular === 'illegal')?.slug ?? ''

    // Belt and braces: a stale selection file from before this was fixed must
    // not put the row back in the model's catalog.
    const entries = catalogEntriesOf(skills.listSkills(), [dirSlug])
    expect(entries.map((e) => e.name)).not.toContain('demo-category')
    expect(entries.map((e) => e.name)).toContain('smc-skill-index')
  })

  it('never hands a CLI to a directory that is not a skill', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'demo-category')
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts', 'run-cli.ps1'), '# pretend CLI', 'utf8')

    // The row's `path` is the directory itself, so "the skill's folder" would
    // resolve to the *skill root* — and the CLI inside would be advertised
    // under this row's name, from a directory the agent cannot even load.
    const listed = new CliManager(skills).list()
    expect(listed.find((c) => c.skill === 'demo-category')).toBeUndefined()
  })

  it('flags every root independently, with no cross-root suppression', () => {
    const skills = new SkillsManager()
    mkdirSync(join(userSkills(), 'demo-dup'), { recursive: true })
    mkdirSync(join(agentsSkills(), 'demo-dup'), { recursive: true })

    const rows = skills.listSkills().filter((r) => r.name === 'demo-dup')
    expect(rows.length).toBe(2)
    // Each row's slug names its own root, so resolving one never reads the other.
    const [a, b] = rows.map((r) => r.slug)
    expect(a).not.toBe(b)
    expect(a).toContain('user-dsh')
    expect(b).toContain('user-agents')
  })
})
