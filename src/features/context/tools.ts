/**
 * The agent-facing half of the context engine: the `skill_select` tool the
 * model calls to enable/disable skills for its own conversation, plus the
 * apply-to-agent helper the routes and the lifecycle hook share.
 *
 * Installing the registrations is `./apply.ts`'s job — it owns the cordis
 * fiber lifetimes. What lives here is *deciding* what should be installed and
 * *reporting* what actually happened, honestly:
 *
 * - the requested state decides set/unset; nothing is flipped blind, so asking
 *   for `selected: true` on an already-selected skill is a no-op, not a
 *   surprise removal;
 * - the selection file is written **only after** an apply succeeded, so a
 *   failure can never leave the file (and the panel) claiming a skill is on;
 * - a failed apply is answered with `applied: false` + `error`, never thrown —
 *   the model needs to learn what state it left behind, and a bare throw tells
 *   it nothing.
 * @module
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { SkillsManager } from '../skills/index.ts'
import type { ApplyOutcome, SkillBindings } from './apply.ts'
import type { ContextSelection } from './engine.ts'
import { commitSelection, planSelection, readSelection, workspaceOf } from './engine.ts'

/** The slice of a real dsh Agent this engine touches. */
export interface AgentLike {
  /** Session id (stable across turns). */
  readonly id: string
  /** The agent's own (scoped) context — registrations land in its layer. */
  readonly ctx: Context
  /** Workspace the conversation runs in. */
  readonly session?: { header?: { cwd?: string } }
}

/** The workspace a conversation runs in, as dsh reports it. */
export function workspaceOfAgent(agent: AgentLike): string {
  return workspaceOf(agent.session?.header?.cwd)
}

/**
 * Turn one selection into runtime registrations.
 * @returns the resolvable registrations, plus the slugs nothing could resolve
 *   (the canonical copy is gone) so the caller can report them.
 */
function registrationsFor(
  skills: SkillsManager,
  selection: ContextSelection,
): { registrations: SkillRegistration[]; missing: string[] } {
  const registrations: SkillRegistration[] = []
  const missing: string[] = []
  for (const slug of selection.selected) {
    const found = skills.resolveRegistration(slug)
    if (found === undefined) missing.push(slug)
    else registrations.push(found)
  }
  return { registrations, missing }
}

/**
 * Bring one conversation's agent in line with its selection file.
 *
 * The lifecycle hook (a new or resumed conversation), the panel and the tool
 * all call this; it is idempotent, so calling it again with the same selection
 * costs nothing and never disturbs a working binding.
 *
 * Never throws: the callers are on the session-creation path, where an
 * exception would veto the conversation itself.
 */
export async function applyToAgent(
  skills: SkillsManager,
  bindings: SkillBindings,
  agent: AgentLike,
): Promise<ApplyOutcome> {
  const workspace = workspaceOfAgent(agent)
  const selection = readSelection(workspace, agent.id)
  const { registrations, missing } = registrationsFor(skills, selection)
  return bindings.ensureAgent(agent, agent.ctx, registrations, missing)
}

/** The result shape `skill_select` answers with. */
interface SkillSelectResult {
  slug: string
  /** Whether `slug` ended up selected — the *outcome*, not the request. */
  selected: boolean
  selectedAll: string[]
  applied: boolean
  /** Slugs the selection named whose canonical copy is gone. */
  missing: string[]
  /** Why nothing was applied ('' when it was). */
  error: string
}

/**
 * The `skill_select` tool: the model's only sanctioned way to change which
 * skills its conversation sees. Plans the change, applies it through the
 * calling agent's own context, and persists only once that worked.
 */
export function buildSkillSelectTool(skills: SkillsManager, bindings: SkillBindings) {
  return defineTool({
    name: 'skill_select',
    description:
      '为本对话启用或停用一个技能（写入会话的技能选择配置并立即生效）。' +
      '仅可启用管理页清单中的技能；默认全部未选。',
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
          applied: { type: 'boolean' },
          missing: { type: 'array', items: { type: 'string' } },
          error: { type: 'string' },
        },
      },
      // Read the *result*, never the request: the previous version echoed the
      // argument, so asking to enable an already-enabled skill reported
      // "已启用" while the call had actually disabled it.
      render: (_args, value) => {
        const v = value as Partial<SkillSelectResult> | null
        if (v === null || typeof v !== 'object' || typeof v.slug !== 'string') {
          return [{ type: 'text', text: 'skill_select 完成' }]
        }
        const all = JSON.stringify(v.selectedAll ?? [])
        if (v.applied !== true) {
          return [{ type: 'text', text: `技能 ${v.slug} 未生效（${v.error || '原因未知'}）；本对话当前选择：${all}` }]
        }
        const gone = (v.missing?.length ?? 0) > 0 ? `；另有 ${v.missing?.length} 个已不存在，未列入` : ''
        return [{ type: 'text', text: `技能 ${v.slug} ${v.selected ? '已启用' : '已停用'}${gone}；本对话当前选择：${all}` }]
      },
    },
    execute: async (args, exec) => {
      const agent = exec.agent as AgentLike | undefined
      if (agent === undefined) throw new Error('skill_select 只能在会话内调用')
      const workspace = workspaceOfAgent(agent)
      const planned = planSelection(workspace, agent.id, args.slug, args.selected)
      const { registrations, missing } = registrationsFor(skills, planned)
      try {
        const outcome = await bindings.ensureAgent(agent, agent.ctx, registrations, missing)
        if (outcome.applied) commitSelection(workspace, planned)
        return {
          slug: args.slug,
          selected: planned.selected.includes(args.slug),
          selectedAll: planned.selected,
          applied: outcome.applied,
          missing: outcome.missing,
          error: outcome.error ?? '',
        }
      } catch (error) {
        // Nothing was applied, so nothing was written: report the state the
        // conversation is really in rather than the one that was requested.
        const current = readSelection(workspace, agent.id)
        return {
          slug: args.slug,
          selected: current.selected.includes(args.slug),
          selectedAll: current.selected,
          applied: false,
          missing,
          error: String((error as Error)?.message ?? error),
        }
      }
    },
  })
}
