/**
 * DESCRIPTION.md as an admission document.
 *
 * A skill directory is recognized when it holds SKILL.md or DESCRIPTION.md —
 * either one is enough. SKILL.md keeps the strict frontmatter rule (name +
 * description); a DESCRIPTION.md-only skill takes its name from the directory
 * and its description from the document body, migrates like any other bundle,
 * and stays usable through the context engine (resolveRegistration).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillsManager } from '../src/features/skills/index.ts'
import { storeSkillsDir } from '../src/shared/paths.ts'

let home: string
let agents: string
let origHome: string | undefined
let origAgents: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-desc-test-' + id)
  agents = join(tmpdir(), 'dsh-desc-agents-' + id)
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

/** Write a DESCRIPTION.md-only bundle (`<root>/<dir>/DESCRIPTION.md`). */
function descBundle(root: string, dir: string, body: string): string {
  const target = join(root, dir)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'DESCRIPTION.md'), body, 'utf8')
  return target
}

describe('DESCRIPTION.md-only skills', () => {
  it('lists a directory holding only DESCRIPTION.md as a native skill', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'plain-doc', '# 我的小工具\n\n它能做一件事。')

    const found = skills.listSkills().find((s) => s.slug === 'plain-doc')
    expect(found).toBeDefined()
    expect(found?.name).toBe('plain-doc')
    expect(found?.description).toBe('我的小工具')
    expect(found?.group).toBe('native')
    expect(found?.path).toBe(join(userSkills(), 'plain-doc', 'DESCRIPTION.md'))
  })

  it('prefers SKILL.md when both documents exist', () => {
    const skills = new SkillsManager()
    const dir = descBundle(userSkills(), 'both', 'plain body')
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: both\ndescription: from frontmatter\n---\nbody of both', 'utf8')

    const found = skills.listSkills().find((s) => s.slug === 'both')
    expect(found?.name).toBe('both')
    expect(found?.description).toBe('from frontmatter')
    expect(found?.path).toBe(join(userSkills(), 'both', 'SKILL.md'))
  })

  it('falls back to DESCRIPTION.md when SKILL.md lacks frontmatter', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'broken')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), 'no frontmatter here', 'utf8')
    writeFileSync(join(dir, 'DESCRIPTION.md'), 'fallback description', 'utf8')

    const found = skills.listSkills().find((s) => s.slug === 'broken')
    expect(found).toBeDefined()
    expect(found?.name).toBe('broken')
    expect(found?.description).toBe('fallback description')
  })

  it('keeps ignoring directories that hold neither document', () => {
    const skills = new SkillsManager()
    mkdirSync(join(userSkills(), 'not-a-skill'), { recursive: true })
    writeFileSync(join(userSkills(), 'not-a-skill', 'README.md'), 'hello', 'utf8')

    expect(skills.listSkills().find((s) => s.slug === 'not-a-skill')).toBeUndefined()
  })

  it('does not treat a bare DESCRIPTION.md file as a flat skill', () => {
    const skills = new SkillsManager()
    mkdirSync(userSkills(), { recursive: true })
    writeFileSync(join(userSkills(), 'DESCRIPTION.md'), '# loose', 'utf8')

    expect(skills.listSkills()).toEqual([])
  })

  it('migrates a DESCRIPTION.md-only bundle into the store and links it back', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'desc-skill', '# 标题\n正文。')

    const result = skills.migrate()
    expect(result.moved).toBe(1)
    expect(result.failures).toEqual([])
    expect(existsSync(join(store(), 'desc-skill', 'DESCRIPTION.md'))).toBe(true)
    // Reached through the junction back in ~/.dsh/skills.
    expect(existsSync(join(userSkills(), 'desc-skill', 'DESCRIPTION.md'))).toBe(true)

    const found = skills.listSkills().find((s) => s.slug === 'desc-skill')
    expect(found?.group).toBe('stored')
    expect(found?.linked).toBe(true)
    expect(found?.path).toBe(join(store(), 'desc-skill', 'DESCRIPTION.md'))
  })

  it('resolves a DESCRIPTION.md-only stored skill for the context engine', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'desc-skill', '# 标题\n正文。')
    skills.migrate()

    const reg = skills.resolveRegistration('desc-skill')
    expect(reg).toBeDefined()
    expect(reg?.name).toBe('desc-skill')
    expect(reg?.description).toBe('标题')
    expect(reg?.content).toBe('# 标题\n正文。')
  })

  it('reads a DESCRIPTION.md path through readSkill', () => {
    const skills = new SkillsManager()
    const dir = descBundle(userSkills(), 'reader', '# 读我\n\n内容。')

    const detail = skills.readSkill(join(dir, 'DESCRIPTION.md'))
    expect(detail).not.toBeNull()
    expect(detail?.name).toBe('reader')
    expect(detail?.description).toBe('读我')
    expect(detail?.content).toContain('内容。')
  })
})
