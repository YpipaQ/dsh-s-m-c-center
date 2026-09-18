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
import { parseSkillFile, parseFrontmatter } from '../src/shared/frontmatter.ts'

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

  // Markdown prose is soft-wrapped, so taking the first physical line alone
  // cut sentences mid-clause. The summary joins the opening paragraph.
  it('joins a soft-wrapped first paragraph into one description', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'wrapped', 'Apple / macOS skills — tools that interact with the Mac desktop (Finder,\nnative apps) or system features (accessibility, screenshots).\n')

    const found = skills.listSkills().find((s) => s.slug === 'wrapped')
    expect(found?.description)
      .toBe('Apple / macOS skills — tools that interact with the Mac desktop (Finder, native apps) or system features (accessibility, screenshots).')
  })

  it('stops the description at the first block boundary', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'listed', '一句话介绍。\n\n- 第一项\n- 第二项\n')

    const found = skills.listSkills().find((s) => s.slug === 'listed')
    expect(found?.description).toBe('一句话介绍。')
  })

  it('leaves a heading-only opener as the description', () => {
    const skills = new SkillsManager()
    descBundle(userSkills(), 'headed', '# 标题\n\n正文说明。\n')

    const found = skills.listSkills().find((s) => s.slug === 'headed')
    expect(found?.description).toBe('标题')
  })

  it('keeps ignoring directories that hold neither document', () => {    const skills = new SkillsManager()
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

/**
 * Frontmatter is real YAML, not one scalar per line.
 *
 * `description: >` and `description: |` are legal block scalars and they are
 * what the model sees in the skill catalog — and the engine's registration
 * *overrides* dsh's native entry, so a wrong value here is not a display nit:
 * it is what the agent reads instead of the author's description.
 */
describe('block scalars', () => {
  it('folds `>` into one line and keeps `|` as written', () => {
    const folded = [
      '---',
      'name: demo-skill',
      'description: >',
      '  完整的 DEMO-SKILL 动画技能包。',
      '  覆盖核心 Tween API。',
      '---',
      '',
      '# body',
    ].join('\n')
    const literal = [
      '---',
      'name: note',
      'description: |',
      '  第一行',
      '  第二行',
      '---',
      '',
      '# body',
    ].join('\n')

    expect(parseSkillFile(folded)?.description).toBe('完整的 DEMO-SKILL 动画技能包。 覆盖核心 Tween API。')
    expect(parseSkillFile(literal)?.description).toBe('第一行\n第二行')
  })

  it('reads the chomping variants and stops at the first dedented line', () => {
    const doc = [
      '---',
      'name: x',
      'description: |-',
      '  kept verbatim',
      'name2: after',
      '---',
      '',
      '# body',
    ].join('\n')
    const parsed = parseSkillFile(doc)
    expect(parsed?.description).toBe('kept verbatim')
    // The next key at column zero is not part of the block.
    expect(parseFrontmatter(doc)?.data.name2).toBe('after')
  })

  it('an empty block reads as no description, so the document does not pass as a skill', () => {
    const doc = ['---', 'name: x', 'description: >', '---', '', '# body'].join('\n')
    expect(parseSkillFile(doc)).toBeNull()
  })
})

/**
 * The author's call policy. Both keys default to *allowed*, so only an
 * explicit `disable-model-invocation: true` / `user-invocable: false` takes
 * something away — and the engine must carry it through, or every registered
 * skill silently becomes model-invocable (undoing the author's intent).
 */
describe('invocation policy', () => {
  it('defaults to allowed when the keys are absent', () => {
    const doc = ['---', 'name: plain', 'description: d', '---', '', 'body'].join('\n')
    expect(parseSkillFile(doc)?.invocation).toEqual({ modelInvocable: true, userInvocable: true })
  })

  it('honours disable-model-invocation and user-invocable', () => {
    const doc = [
      '---',
      'name: guarded',
      'description: d',
      'disable-model-invocation: true',
      'user-invocable: false',
      '---',
      '',
      'body',
    ].join('\n')
    expect(parseSkillFile(doc)?.invocation).toEqual({ modelInvocable: false, userInvocable: false })
  })

  it('an absent user-invocable is not a denial', () => {
    const doc = [
      '---',
      'name: guarded',
      'description: d',
      'disable-model-invocation: true',
      '---',
      '',
      'body',
    ].join('\n')
    expect(parseSkillFile(doc)?.invocation).toEqual({ modelInvocable: false, userInvocable: true })
  })
})

describe('registration payload', () => {
  it('carries the bundle directory into the registration', () => {
    const skills = new SkillsManager()
    const dir = join(userSkills(), 'guarded')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), [
      '---',
      'name: guarded',
      'description: guarded skill',
      'disable-model-invocation: true',
      '---',
      '',
      'body',
    ].join('\n'), 'utf8')
    skills.migrateToStore(dir, 'bundle', 'user-dsh')

    const registration = skills.resolveRegistration('guarded')
    // Without the base directory the model is told resources are "managed by
    // provider" and gets no path, so `references/` becomes unreachable.
    expect(registration?.resourceBase).toEqual({ kind: 'directory', path: join(store(), 'guarded') })
    // The author's call policy is parsed (see 'invocation policy') but is *not*
    // pushed into the registration: a skill the user enables must actually
    // become usable, and dsh's default for a missing policy is "allowed".
    expect(registration?.invocation).toBeUndefined()
  })

  it('points a flat skill at the directory holding it, not at the file', () => {
    const skills = new SkillsManager()
    const outside = join(home, 'incoming')
    mkdirSync(outside, { recursive: true })
    const file = join(outside, 'flat-skill.md')
    writeFileSync(file, ['---', 'name: flat-skill', 'description: d', '---', '', 'body'].join('\n'), 'utf8')
    // A flat file that stays where it is (registered, never migrated): the base
    // has to be its directory, because that is where its sibling files live.
    skills.registerExternal([{ sourcePath: file, kind: 'file' }])

    const registration = skills.resolveRegistration('flat-skill')
    expect(registration?.resourceBase).toEqual({ kind: 'directory', path: outside })
  })
})
