/**
 * The shadow takeover: our own `skill` tool plus our own catalog publication.
 *
 * dsh's catalog listener only publishes when the *exact definition* it
 * registered is still what `ctx.tools.get('skill', agent)` resolves to
 * (tool-skill `:206-220`, asserted by its own spec `:754-772`). Registering a
 * same-named tool inside the agent's scope breaks that identity, so dsh stops
 * publishing its catalog — which is built from the skill roots and grows with
 * the machine, listing every linked skill whether or not this conversation
 * picked it.
 *
 * What replaces it is entirely ours:
 *
 * - The **shadow `skill` tool** loads a skill, but only one this conversation
 *   has enabled (the relay table's selection, index included). An unenabled
 *   name is a refusal with the way out, not a silent load: the switch the user
 *   flips finally decides what the model can *load*, not just what it sees.
 * - The **catalog publisher** is our own `agent/pre-step` listener that posts
 *   the same `<available_skills>` frame, but with exactly the entries this
 *   conversation publishes (the selection plus the index). Its message source
 *   uses a private kind, `smc-catalog`: dsh's catalog bookkeeping only
 *   recognizes its own `skill-catalog` kind, so the two catalogs never
 *   overwrite each other.
 *
 * `/name` is untouched: dsh's gesture listener is an independent pre-step that
 * resolves `user-invocable` skills through the skill service, not through the
 * tool, so the user's manual escape hatch survives the takeover.
 *
 * Everything here installs and unwinds with the conversation: the tool rides
 * the same injected fiber as the skill registrations (see `apply.ts`), and the
 * listener is registered through the plugin context whose teardown removes it.
 * @module
 */

import { createHash } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { renderSkillContent } from '@deepseek-ai/dsh-skill'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type { SkillsManager } from '../skills/index.ts'
import { INDEX_NAME, buildIndexSkill, catalogEntriesOf } from '../skills/catalog.ts'
import { readSelection } from './engine.ts'
import type { AgentLike } from './tools.ts'

/** Message-source kind of our catalog frames — deliberately not dsh's. */
export const CATALOG_KIND = 'smc-catalog'

/** One row of the model-facing catalog. */
export interface CatalogEntry {
  name: string
  description: string
}

/** The durable payload our catalog message records, mirroring dsh's shape. */
export interface SmcCatalogSource {
  readonly kind: 'smc-catalog'
  readonly form: 'catalog'
  /** Marks a replacement catalog rather than this session's first publication. */
  readonly update?: true
  readonly entries: readonly CatalogEntry[]
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'smc-catalog': SmcCatalogSource
  }
}

/** Catalog identity, dsh-style: hash the entries, not the prose around them. */
export function smcDigest(entries: readonly CatalogEntry[]): string {
  const canonical = entries.map((entry) => JSON.stringify([entry.name, entry.description])).join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

/** Same cap dsh applies, so our lines never render longer than its own. */
function catalogDescription(value: string): string {
  const normalized = value.replaceAll(/\s+/g, ' ').trim()
  return normalized.length <= 500 ? normalized : `${normalized.slice(0, 497)}...`
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function renderLines(entries: readonly CatalogEntry[]): string[] {
  return entries.map((entry) => `- \`${entry.name}\`: ${escapeText(catalogDescription(entry.description))}`)
}

const TOOL_GUIDANCE = [
  "If the user names a skill, or the task clearly matches a skill's description, call the `skill` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.",
  'A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.',
]

/**
 * The model-facing catalog message. First publication states the frame;
 * a replacement says so explicitly, so the model drops names it saw earlier.
 */
export function renderSmcCatalog(entries: readonly CatalogEntry[], update: boolean): ReturnType<typeof createUserMessage> {
  const body = update
    ? [
        '<system-reminder>',
        'The available skill catalog changed. This complete catalog replaces every earlier available-skills list in this session:',
        '',
        '<available_skills>',
        ...renderLines(entries),
        '</available_skills>',
        '',
        'Use only names in this replacement catalog. If the user names a listed skill, or the task clearly matches its description, call the `skill` tool with the exact name before acting.',
        ...TOOL_GUIDANCE.slice(1),
        '</system-reminder>',
      ]
    : [
        '<system-reminder>',
        'A skill is a reusable set of task-specific instructions. The following skills are available in this session:',
        '',
        '<available_skills>',
        ...renderLines(entries),
        '</available_skills>',
        '',
        ...TOOL_GUIDANCE,
        '</system-reminder>',
      ]
  return createUserMessage({
    content: [{ type: 'text', text: body.join('\n') }],
    source: { kind: CATALOG_KIND, form: 'catalog', ...(update ? { update: true as const } : {}), entries },
  })
}

/**
 * What this step's message list should look like for `entries`.
 *
 * A message with the same digest already in the list is left alone (the step
 * is a no-op); a different one is replaced in place and announced as an
 * update; none means this is the first publication. Only our own kind is
 * considered — dsh's catalog messages are another plugin's property here.
 */
export function nextCatalogDecision<T extends { id: string; source?: { kind?: string } }>(
  messages: readonly T[],
  entries: readonly CatalogEntry[],
): readonly T[] | undefined {
  const digest = smcDigest(entries)
  const existing = messages.find((message) => {
    const source = message.source as { kind?: string; entries?: unknown } | undefined
    if (source?.kind !== CATALOG_KIND || !Array.isArray(source.entries)) return false
    const readable = source.entries as readonly CatalogEntry[]
    return readable.every((entry) => typeof entry.name === 'string' && typeof entry.description === 'string')
  })
  if (existing !== undefined) {
    const source = existing.source as { entries: readonly CatalogEntry[] }
    if (smcDigest(source.entries) === digest) return undefined
  }
  const published = renderSmcCatalog(entries, existing !== undefined)
  const publishedWithId = { ...published, id: existing?.id }
  return existing === undefined
    ? [...messages, publishedWithId as unknown as T]
    : messages.map((message) => (message.id === existing.id ? publishedWithId as unknown as T : message))
}

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The shadow `skill` tool.
 *
 * Same name, same call shape, same rendered output as dsh's — but the gate is
 * this conversation's selection, read from the relay table. Loading a skill
 * the conversation never enabled is a refusal that says how to get it, which
 * is what makes the panel's switch real beyond visibility.
 *
 * @param skills - the manager the registrations resolve through.
 */
export function buildShadowSkillTool(skills: SkillsManager) {
  return defineTool({
    name: 'skill',
    description: 'Load the full instructions for an available skill. Call this with the exact skill name from the session skill catalog before acting on a task that names or clearly matches that skill.',
    parameters: {
      name: { type: 'string', required: true, description: 'The exact skill name from the available skills list.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', required: true },
          provider: { type: 'string', required: true },
          resourceBase: { type: 'object', additionalProperties: true },
          content: { type: 'string', required: true },
        },
      },
      render: (_args: unknown, value: Parameters<typeof renderSkillContent>[0]) => [{ type: 'text', text: renderSkillContent(value) }],
    },
    async execute(args: { name: string }, exec: { agent?: AgentLike; signal?: AbortSignal }) {
      const name = typeof args.name === 'string' ? args.name : ''
      if (!SKILL_NAME.test(name)) throw new Error(`invalid skill name "${name}"`)
      const agent = exec.agent
      const workspace = agent?.session?.header?.cwd ?? ''
      const enabled = new Set(readSelection(agent?.id ?? '').selected)
      // The index rides every publish, so it loads even with an empty selection.
      if (name !== INDEX_NAME && !enabled.has(name)) {
        throw new Error(
          `skill "${name}" is not enabled in this conversation. Ask the user to enable it, or enable it yourself with the skill_select tool; skill_query lists what exists.`,
        )
      }
      const rows = skills.listSkills(workspace)
      let registration: SkillRegistration | undefined
      if (name === INDEX_NAME) {
        registration = buildIndexSkill(rows, [...enabled])
      } else {
        const slug = rows.find((row) => row.name === name)?.slug
        if (slug === undefined || slug === '') {
          throw new Error(`skill "${name}" is unknown or no longer available`)
        }
        registration = skills.resolveRegistration(slug)
      }
      if (registration === undefined) throw new Error(`skill "${name}" is unknown or no longer available`)
      return {
        name: registration.name,
        provider: registration.source,
        ...(registration.resourceBase !== undefined ? { resourceBase: { ...registration.resourceBase } } : {}),
        content: registration.content,
      }
    },
    presentCall(args: { name: string }) {
      return { card: 'generic' as const, title: `Load skill ${args.name}`, kind: 'read' as const, rawInput: args.name }
    },
  })
}

/**
 * Per-agent cache of the last published entries: a pre-step runs every turn,
 * and a full library scan per turn is exactly the cost this module exists to
 * avoid. Invalidated whenever the selection or the workspace changes.
 */
const lastPublished = new WeakMap<AgentLike, { workspace: string; selection: string; entries: CatalogEntry[] }>()

/**
 * Entries this conversation's catalog should show, with the scan cached.
 *
 * The cache key is workspace + selection, so a flip recomputes exactly once
 * and every untouched turn after it is a map lookup.
 */
export function catalogEntriesFor(agent: AgentLike, skills: SkillsManager): CatalogEntry[] {
  const workspace = agent?.session?.header?.cwd ?? ''
  const selected = readSelection(agent?.id ?? '').selected
  const selection = selected.join(',')
  const cached = lastPublished.get(agent)
  if (cached !== undefined && cached.workspace === workspace && cached.selection === selection) {
    return cached.entries
  }
  const entries = catalogEntriesOf(skills.listSkills(workspace), selected)
  lastPublished.set(agent, { workspace, selection, entries })
  return entries
}

/**
 * Register our catalog publisher on the plugin context.
 *
 * Runs after the rest of the step's waterfall (`next()` first), appends or
 * replaces our frame, and never throws into the step: a catalog hiccup must
 * not fail the turn, so everything is wrapped.
 */
export function attachSmcCatalog(ctx: { on(event: string, listener: unknown): unknown }, skills: SkillsManager): void {
  ctx.on('agent/pre-step', async (
    { agent }: { agent: AgentLike },
    next: () => Promise<{ kind: string; messages?: unknown[] }>,
  ) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    try {
      const messages = (decision.messages ?? []) as readonly { id: string; source?: { kind?: string } }[]
      const nextMessages = nextCatalogDecision(messages, catalogEntriesFor(agent, skills))
      if (nextMessages === undefined) return decision
      return { ...decision, messages: nextMessages }
    } catch {
      // The native catalog is dark under the shadow tool; a failed publish
      // must not become a failed turn. The next step retries.
      return decision
    }
  })
}
