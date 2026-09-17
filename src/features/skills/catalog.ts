/**
 * The catalog hijack.
 *
 * dsh publishes a skill catalog before every step: one
 * ``- `name`: description`` line for each model-invocable skill in the
 * conversation's scope. It is the model's only index of what exists, and it is
 * built from whatever is linked into the skill roots — so it grows with the
 * machine, never with the conversation, and it cannot list a skill that is
 * stored but not linked.
 *
 * The plugin already overrides those lines: a registration inside the
 * conversation's own layer wins over the filesystem entry of the same name, so
 * whatever we register is what the model reads. This module uses that to add
 * exactly one line — an index skill — whose body carries the *complete* list in
 * the very same shape. The catalog's standing cost stays at one line, and the
 * full list is paid for only when someone actually asks for it.
 * @module
 */

import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { SkillSummary } from '../../shared/protocol/index.ts'

/** Name of the index skill in the catalog (also usable as `/smc-skill-index`). */
export const INDEX_NAME = 'smc-skill-index'

/**
 * The one line the index contributes to the catalog. It has to be a pointer
 * and nothing else: this text sits in the model's context on every single step.
 */
const INDEX_DESCRIPTION =
  '技能目录索引：加载本技能可取得本机完整技能列表（格式与技能目录层一致，含每条的联接与启用状态）。' +
  '你要找的技能若不在目录里，先加载本技能再决定如何启用。'

/** State of one row, in the fewest words that still let the model act on it. */
function stateOf(skill: SkillSummary, selected: Set<string>): string {
  const chosen = skill.slug !== undefined && selected.has(skill.slug)
  const parts = [
    skill.linked ? '已联接' : '未联接',
    chosen ? '本会话已启用' : '本会话未启用',
  ]
  if (skill.untracked === true) parts.push('联接来源不明')
  return parts.join('·')
}

/**
 * The index skill for one conversation.
 *
 * @param rows - every skill the manager knows (linked or not, enabled or not).
 * @param selected - the slugs enabled in this conversation.
 */
export function buildIndexSkill(rows: SkillSummary[], selected: string[]): SkillRegistration {
  const chosen = new Set(selected)
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name))
  const lines = sorted.map((skill) => (
    `- \`${skill.name}\`: ${skill.description || skill.name} 【${stateOf(skill, chosen)}】`
  ))
  const content = [
    `本机技能完整目录（共 ${sorted.length} 条，格式与技能目录层一致）。`,
    '',
    ...lines,
    '',
    '读法：',
    '- 已联接 = 该技能在技能目录下，全局所有会话（含子智能体）都能看到。',
    '- 本会话已启用 = 已注册进本会话，可直接用 skill 工具加载。',
    '- 需要但本会话未启用：用 skill_select 启用，或请用户在「会话技能」小窗勾选；启用后它才会出现在本会话的目录里。',
    '- 作者标了 disable-model-invocation 的技能不开放给模型：即使请求启用也会被拒绝，这是作者的意图，不是故障。',
  ].join('\n')
  return {
    name: INDEX_NAME,
    description: INDEX_DESCRIPTION,
    content,
    source: 'runtime',
    // An index has no files of its own; saying so beats the default hint, which
    // would invite the model to go looking for a base directory.
    resourceBase: { kind: 'opaque', description: '本技能只是索引，没有附属文件。' },
    invocation: { modelInvocable: true, userInvocable: true },
  }
}
