/**
 * The index skill's access rule.
 *
 * `smc-skill-index` is a pointer whose body is a complete inventory of the
 * workspace's skills — and an inventory is exactly the kind of thing a model
 * loads "just to be sure". The rule that it must not be opened without a real
 * need is therefore part of both surfaces the model reads: the catalog line
 * (every step) and the body (after loading). These tests pin that rule so a
 * later copy edit cannot quietly turn the index back into an open invitation.
 * @module
 */
import { describe, expect, it } from 'vitest'
import type { SkillSummary } from '../src/shared/protocol/index.ts'
import { INDEX_NAME, buildIndexSkill, catalogEntriesOf } from '../src/features/skills/index.ts'

const row = (over: Partial<SkillSummary>): SkillSummary => ({
  name: over.name ?? 'x', description: over.description ?? 'd', group: 'stored',
  linked: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'p',
  slug: over.slug ?? over.name ?? 'x', ...over,
})

const rows = [
  row({ name: 'demo-linked', slug: 'demo-linked', linked: true }),
  row({ name: 'demo-idle', slug: 'demo-idle', linked: false }),
]

describe('buildIndexSkill', () => {
  it('states the access rule on the catalog line', () => {
    const skill = buildIndexSkill(rows, [])
    expect(skill.name).toBe(INDEX_NAME)
    // The line the model sees every step must carry the gate.
    expect(skill.description).toContain('无必要不要加载')
    // …and must not read as an invitation (the old wording said "load this first").
    expect(skill.description).not.toContain('先加载本技能')
  })

  it('repeats the rule, with its reasons, in the body', () => {
    const skill = buildIndexSkill(rows, [])
    expect(skill.content).toContain('使用约束')
    expect(skill.content).toContain('无必要不要加载本技能')
    expect(skill.content).toContain('复述')      // do not dump the list at the user
    expect(skill.content).toContain('skill_select') // enabling stays an explicit act
  })

  it('keeps the full inventory and the reading rules', () => {
    const skill = buildIndexSkill(rows, ['demo-linked'])
    expect(skill.content).toContain('共 2 条')
    expect(skill.content).toContain('`demo-linked`')
    expect(skill.content).toContain('`demo-idle`')
    expect(skill.content).toContain('本会话已启用')
    expect(skill.content).toContain('读法')
  })

  it('is model-invocable, or dsh would filter it out of the catalog', () => {
    expect(buildIndexSkill(rows, []).invocation?.modelInvocable).toBe(true)
  })
})

describe('catalogEntriesOf index line', () => {
  it('carries the same access rule as the skill body', () => {
    const entries = catalogEntriesOf(rows, ['demo-linked'])
    const index = entries.find((entry) => entry.name === INDEX_NAME)
    const description = buildIndexSkill(rows, []).description
    expect(index?.description).toBe(description)
    expect(index?.description).toContain('无必要不要加载')
  })

  it('still lists only the selected skills next to the index', () => {
    const entries = catalogEntriesOf(rows, ['demo-linked'])
    expect(entries.map((entry) => entry.name)).toEqual(['demo-linked', INDEX_NAME])
  })
})
