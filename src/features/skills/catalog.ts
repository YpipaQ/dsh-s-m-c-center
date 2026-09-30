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
 *
 * It also carries the access rule: the body is a complete inventory, and an
 * inventory is exactly the kind of thing a model will load "just to be sure".
 * The gate is stated here — on the line the model reads every step — so the
 * default is not to open it.
 */
const INDEX_DESCRIPTION =
  '技能目录索引：本工作区全部技能清单（含联接与启用状态）。**无必要不要加载**——仅当目录里找不到所需技能，'
  + '或用户明确要求清点 / 查看技能清单时才加载；加载后不要把清单整篇复述给用户。'

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
  if (skill.irregular === 'illegal') {
    // Not a skill, and dsh would not see one in there either. The model should
    // relay that plainly rather than treating the row as something loadable.
    parts.push('非法技能（不符合常规技能格式：无 SKILL.md / DESCRIPTION.md）')
    return parts.join('·')
  }
  if (skill.missing === true) parts.push('⚠ 正本已失效')
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
    '使用约束：',
    '- 无必要不要加载本技能。不要为了确认某个技能是否存在、或出于好奇浏览而加载它；目录行本身已足够决定行动。',
    '- 加载后不要把完整列表整篇复述给用户，除非用户就是要这份清单。',
    '- 列表只是状态快照，不构成行动建议；启用 / 停用某个技能仍要用 skill_select，或由用户在「会话技能」小窗勾选。',
    '',
    ...lines,
    '',
    '读法：',
    '- 已联接 = 该技能在 dsh 的技能根下，全局所有会话（含子智能体）都会看到它。',
    '- 本会话已启用 = 已注册进本会话，可直接用 skill 工具加载。',
    '- 需要但本会话未启用：用 skill_select 启用，或请用户在「会话技能」小窗勾选；启用后它才会出现在本会话的目录里。',
    '- 容器目录（只有 DESCRIPTION.md）没有可加载的正文，要启用它下面的具体技能。',
    '- 标「非法技能」的条目**不可加载**：它是一个目录，但里面没有合格的技能文档，'
      + 'dsh 同样看不见其中的任何技能。它只是如实告诉你技能根目录里有这么一项，'
      + '需要用户处理（补上 SKILL.md / DESCRIPTION.md，或把它移走）。',
    '- 标「正本已失效」的登记技能指向的目录已不存在或不再含技能，需要用户重新登记或取消登记。',
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
    // A directory with no admission document is not a skill, so it never earns
    // a line here — and this is checked *as well as* the slug match, because a
    // selection file written before that rule existed can still name one, and a
    // stale file must not be able to put a non-skill back in the model's
    // catalog. The index body still lists it (flagged), which is where the
    // model should learn about it.
    if (skill.irregular !== undefined) continue
    entries.push({ name: skill.name, description: oneLine(skill.description || skill.name) })
  }
  entries.push({ name: INDEX_NAME, description: oneLine(INDEX_DESCRIPTION) })
  return entries
}
