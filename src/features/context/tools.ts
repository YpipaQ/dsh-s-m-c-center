/**
 * The agent-facing half of the context engine: the `skill_select` tool the
 * model calls to enable/disable skills for its own conversation, plus the
 * apply-to-agent helper the routes use when the panel flips a switch.
 *
 * The tool writes the same per-conversation JSON the panel writes, then
 * re-applies the selection through the agent's own context — the official
 * registry re-publishes the catalog, so the change is live on the next step.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillsManager } from '../skills/index.ts'
import { applySelection, toggleSelection, workspaceOf } from './engine.ts'

/** The slice of a real dsh Agent this engine touches. */
export interface AgentLike {
  /** Session id (stable across turns). */
  readonly id: string
  /** The agent's own (scoped) context — registrations land in its layer. */
  readonly ctx: Context
  /** Workspace the conversation runs in. */
  readonly session?: { header?: { cwd?: string } }
}

/** Read a runtime registration for one slug from the store / registry. */
export function resolveRegistration(skills: SkillsManager, slug: string) {
  return skills.resolveRegistration(slug)
}

/**
 * Apply one conversation's current selection to its agent: dispose the
 * previous set, register the new one through `agent.ctx`.
 */
export function applyToAgent(skills: SkillsManager, agent: AgentLike): void {
  const workspace = workspaceOf(agent.session?.header?.cwd)
  applySelection(agent.ctx, workspace, agent.id, {
    resolve: (slug) => resolveRegistration(skills, slug),
  })
}

/**
 * The `skill_select` tool: the model's only sanctioned way to change which
 * skills its conversation sees. Writes the same JSON the panel writes, then
 * re-applies through the calling agent's own context.
 */
export function buildSkillSelectTool(skills: SkillsManager) {
  return defineTool({
    name: 'skill_select',
    description:
      '为本对话启用或停用一个技能（写入会话的技能选择配置并立即生效）。' +
      '仅可启用管理页公告清单中的技能；默认全部未选。',
    parameters: {
      slug: { type: 'string', required: true, description: '技能 slug（储存库目录名或登记表 slug）' },
      selected: { type: 'boolean', required: true, description: 'true=为本对话启用，false=停用' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          slug: { type: 'string' },
          selected: { type: 'boolean' },
          selectedAll: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (args, value) => [
        {
          type: 'text',
          text: typeof value === 'object' && value !== null && 'slug' in value
            ? `技能 ${String((value as { slug: string }).slug)} 已${(value as { selected: boolean }).selected ? '启用' : '停用'}；本对话当前选择：${JSON.stringify((value as { selectedAll: string[] }).selectedAll)}`
            : 'skill_select 完成',
        },
      ],
    },
    execute: async (args, exec) => {
      const agent = exec.agent as AgentLike | undefined
      if (agent === undefined) throw new Error('skill_select 只能在会话内调用')
      const workspace = workspaceOf(agent.session?.header?.cwd)
      const next = toggleSelection(workspace, agent.id, args.slug)
      applySelection(agent.ctx, workspace, agent.id, {
        resolve: (slug) => resolveRegistration(skills, slug),
      })
      return { slug: args.slug, selected: args.selected, selectedAll: next.selected }
    },
  })
}
