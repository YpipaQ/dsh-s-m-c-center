/**
 * The catalog index skill — our one line in the model's skill catalog.
 *
 * dsh publishes a skill catalog before every step: one ``- `name`: description``
 * line for each model-invocable skill in the conversation's scope. It is built
 * from whatever the skill roots hold plus whatever the conversation's own layer
 * registers, so it grows with the machine and never with the conversation — a
 * skill that is stored but not linked is simply absent, and the model has no way
 * to ask what exists.
 *
 * This module adds exactly one entry: a pointer whose *body* carries the
 * complete list in that same shape. The catalog's standing cost stays at one
 * line, and the full list is paid for only when the model loads it.
 *
 * It rides along with every apply (see `publishSet` in the context engine), so
 * it is in the catalog whether or not anything has been selected.
 * @module
 */

import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { SkillSummary } from '../../shared/protocol/index.ts'
import { enableBlocker } from './scanner.ts'

/** Name of the index skill in the catalog (also usable as `/smc-skill-index`). */
export const INDEX_NAME = 'smc-skill-index'

/**
 * The one line the index contributes to the catalog. It has to be a pointer and
 * nothing else: this text sits in the model's context on every single step.
 */
const INDEX_DESCRIPTION =
  '技能目录索引：加载本技能可取得本工作区技能完整列表（格式与技能目录层一致，含每条的联接与启用状态）。' +
  '你要找的技能若不在目录里，先加载本技能再决定如何启用。'

/**
 * One description on one line.
 *
 * `description: |` keeps its newlines, and a single such entry could push blank
 * lines through the middle of the list. dsh folds and caps the same way.
 */
function oneLine(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim()
  // Same cap and same ellipsis style as dsh's own catalog lines, so a row we
  // publish is never longer than one of its own.
  return flat.length > 500 ? flat.slice(0, 497) + '...' : flat
}

/** State of one row, in the fewest words that still let the model act on it. */
function stateOf(skill: SkillSummary, selected: Set<string>): string {
  const parts = [
    skill.linked ? '已联接' : '未联接',
    skill.slug !== undefined && selected.has(skill.slug) ? '本会话已启用' : '本会话未启用',
  ]
  const slug = skill.slug ?? ''
  if (slug !== '' && enableBlocker(slug) !== undefined) parts.push('容器目录（本条正文即该组说明）')
  return parts.join('·')
}

/**
 * The index skill for one conversation.
 *
 * @param rows - every skill the manager knows (linked or not, selected or not).
 * @param selected - the slugs enabled in this conversation.
 */
export function buildIndexSkill(rows: SkillSummary[], selected: string[]): SkillRegistration {
  const chosen = new Set(selected)
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name))
  const lines = sorted.map((skill) => (
    `- \`${skill.name}\`: ${oneLine(skill.description || skill.name)} 【${stateOf(skill, chosen)}】`
  ))
  const content = [
    `本工作区技能完整列表（共 ${sorted.length} 条，格式与技能目录层一致）。`,
    '',
    ...lines,
    '',
    '读法：',
    '- 已联接 = 该技能在 dsh 的技能根下，全局所有会话（含子智能体）都会看到它。',
    '- 本会话已启用 = 已注册进本会话，可直接用 skill 工具加载。',
    '- 需要但本会话未启用：用 skill_select 启用，或请用户在「会话技能」小窗勾选；启用后它才会出现在本会话的目录里。',
    '- 容器目录（只有 DESCRIPTION.md）没有可加载的正文，要启用它下面的具体技能。',
  ].join('\n')
  return {
    name: INDEX_NAME,
    description: INDEX_DESCRIPTION,
    content,
    source: 'runtime',
    // An index has no files of its own; saying so beats the default hint, which
    // would invite the model to go looking for a base directory.
    resourceBase: { kind: 'opaque', description: '本技能只是索引，没有附属文件。' },
    // Must be model-invocable, or dsh filters the line out of the catalog.
    invocation: { modelInvocable: true, userInvocable: true },
  }
}

/**
 * The catalog rows for **our own** catalog frame (the shadow takeover, see
 * `features/context/shadow.ts`): exactly the enabled selection plus the index,
 * in dsh's line shape. Unenabled names are absent by construction — that is
 * the whole point of publishing the catalog ourselves.
 *
 * @param rows - every skill the manager knows (linked or not, selected or not).
 * @param selected - the slugs enabled in this conversation.
 */
export function catalogEntriesOf(
  rows: SkillSummary[],
  selected: string[],
): { name: string; description: string }[] {
  const chosen = new Set(selected)
  const entries: { name: string; description: string }[] = []
  for (const skill of [...rows].sort((a, b) => a.name.localeCompare(b.name))) {
    if (skill.slug === undefined || skill.slug === '' || !chosen.has(skill.slug)) continue
    entries.push({ name: skill.name, description: oneLine(skill.description || skill.name) })
  }
  entries.push({ name: INDEX_NAME, description: oneLine(INDEX_DESCRIPTION) })
  return entries
}
