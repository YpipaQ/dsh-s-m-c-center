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

/** The slugs in `selection` whose canonical copy cannot be resolved. */
export function missingSlugs(skills: SkillsManager, selection: ContextSelection): string[] {
  return registrationsFor(skills, selection).missing
}

/**
 * Bring one conversation's agent in line with a selection.
 *
 * The lifecycle hook (a new or resumed conversation), the panel and the tool
 * all call this; it is idempotent, so calling it again with the same selection
 * costs nothing and never disturbs a working binding.
 *
 * `selection` exists because the caller has usually *just computed* the new
 * selection and the file still holds the old one. Re-reading the file here made
 * the panel apply one flip behind — it installed the previous set, answered
 * `applied: true` (the names had not changed, so the idempotent short-circuit
 * fired) and only then wrote the new file. The lifecycle hook passes nothing
 * and keeps reading the file, which is what "apply what this conversation
 * asked for" means at creation time.
 *
 * Never throws: the callers are on the session-creation path, where an
 * exception would veto the conversation itself.
 */
export async function applyToAgent(
  skills: SkillsManager,
  bindings: SkillBindings,
  agent: AgentLike,
  selection?: ContextSelection,
): Promise<ApplyOutcome> {
  const workspace = workspaceOfAgent(agent)
  const chosen = selection ?? readSelection(workspace, agent.id)
  const { registrations, missing } = registrationsFor(skills, chosen)
  return bindings.ensureAgent(agent, agent.ctx, registrations, missing)
}

/**
 * Drop the slugs nothing could resolve, so a phantom name never reaches the
 * selection file and the copy never reports a skill that is not there.
 */
export function withoutMissing(selection: ContextSelection, missing: string[]): ContextSelection {
  if (missing.length === 0) return selection
  const gone = new Set(missing)
  return { ...selection, selected: selection.selected.filter((slug) => !gone.has(slug)) }
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
      // Container rows (a directory with only DESCRIPTION.md) list fine and
      // migrate fine, but they have no body to load: enabling one used to put a
      // dead line in the catalog while the real skills under it stayed
      // unreachable. Say so instead of accepting the flip.
      const blocker = skills.enableBlocker(args.slug)
      if (blocker !== undefined) {
        return {
          slug: args.slug,
          selected: false,
          selectedAll: readSelection(workspace, agent.id).selected,
          applied: false,
          missing: [],
          error: blocker,
        }
      }
      const planned = planSelection(workspace, agent.id, args.slug, args.selected)
      const { registrations, missing } = registrationsFor(skills, planned)
      try {
        const outcome = await bindings.ensureAgent(agent, agent.ctx, registrations, missing)
        // Persist what can actually be resolved: the file is the panel's and
        // the next session's source of truth, so a slug whose copy is gone must
        // not be written into it.
        const keep = withoutMissing(planned, outcome.missing)
        if (outcome.applied) commitSelection(workspace, keep)
        return {
          slug: args.slug,
          selected: keep.selected.includes(args.slug),
          selectedAll: keep.selected,
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

/** One row of `skill_query`'s answer. */
interface QueryRow {
  name: string
  description: string
  group: 'native' | 'stored' | 'registered'
  level: 'project' | 'user'
  /** Linked into a skills root → every conversation already sees it. */
  linked: boolean
  /** Enabled in *this* conversation. */
  selected: boolean
  slug?: string
  /** Whether a flip / load can actually do something with it. */
  usable: boolean
  /** Why not, when not usable. */
  reason?: string
}

interface QueryResult {
  workspace: string
  total: number
  skills: QueryRow[]
}

/** An optional string argument, whatever shape the caller sent. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * One description on one line.
 *
 * A description is not always one line: `description: |` keeps its newlines, so
 * a single entry could otherwise push a blank line through the middle of the
 * list and break it apart. dsh folds the same way, and caps at 500.
 */
function oneLine(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim()
  return flat.length > 500 ? flat.slice(0, 497) + '…' : flat
}

/**
 * The discovery channel: everything the manager knows about this workspace,
 * computed **at call time** — never a baked snapshot.
 *
 * It exists because the catalog only lists what is linked, so a stored-but-
 * unlinked skill is invisible to the model until enabled, and the model had no
 * way to ask. The answer is plain JSON: the previous attempt shipped the list
 * as a loadable pseudo-skill instead, which made the model run a command and
 * handed it a stale, workspace-scoped copy that went stale the moment a
 * selection changed.
 */
export function buildSkillQueryTool(skills: SkillsManager) {
  return defineTool({
    name: 'skill_query',
    description:
      '查询本工作区可见的技能清单（只读，动态计算）。返回全部技能：描述、分组、是否已联接（全局可见）、' +
      '本会话是否已启用，以及未启用原因。要找的技能不在目录里时先查这里。',
    parameters: {
      // Absent `required` is what makes a parameter optional.
      query: { type: 'string', description: '按名称或描述的关键词过滤（不区分大小写）' },
      group: { type: 'string', description: '按分组过滤：native / stored / registered' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspace: { type: 'string' },
          total: { type: 'number' },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                group: { type: 'string' },
                level: { type: 'string' },
                linked: { type: 'boolean' },
                selected: { type: 'boolean' },
                slug: { type: 'string' },
                usable: { type: 'boolean' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        const v = value as Partial<QueryResult> | null
        if (v === null || typeof v !== 'object' || !Array.isArray(v.skills)) {
          return [{ type: 'text', text: 'skill_query 完成' }]
        }
        const lines = v.skills.map((s) => {
          const state = [
            s.linked ? '已联接' : '未联接',
            s.selected ? '本会话已启用' : '本会话未启用',
            ...(s.reason ? [s.reason] : []),
          ].join('·')
          return `- \`${s.name}\`: ${oneLine(s.description || s.name)} 【${state}】`
        })
        return [{
          type: 'text',
          text: [`本工作区可见技能共 ${v.total ?? v.skills.length} 条（本次查询动态计算）。`, ...lines,
            '未启用但需要：用 skill_select 启用，或请用户在「会话技能」小窗勾选。'].join('\n'),
        }]
      },
    },
    execute: async (args, exec) => {
      const agent = exec.agent as AgentLike | undefined
      if (agent === undefined) throw new Error('skill_query 只能在会话内调用')
      const workspace = workspaceOfAgent(agent)
      const selected = new Set(readSelection(workspace, agent.id).selected)
      const keyword = text(args.query).toLowerCase()
      const group = text(args.group).toLowerCase()
      const rows = skills
        .listSkills(workspace)
        .filter((it) => (group === '' || it.group === group))
        .filter((it) => (
          keyword === ''
          || it.name.toLowerCase().includes(keyword)
          || it.description.toLowerCase().includes(keyword)
        ))
        .map((it): QueryRow => {
          const blocker = it.slug === undefined || it.slug === ''
            ? undefined
            : skills.enableBlocker(it.slug)
          const chosen = it.slug !== undefined && selected.has(it.slug)
          return {
            name: it.name,
            description: it.description,
            group: it.group,
            level: it.level,
            linked: it.linked,
            selected: chosen,
            slug: it.slug,
            usable: blocker === undefined,
            ...(blocker !== undefined ? { reason: blocker } : {}),
          }
        })
      return { workspace, total: rows.length, skills: rows }
    },
  })
}
