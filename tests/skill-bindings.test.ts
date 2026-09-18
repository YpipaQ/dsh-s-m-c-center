/**
 * `SkillBindings` — the live half of the context engine.
 *
 * These pin the promises the routes and the tool rely on:
 *
 * - **honest `applied`**: a missing `skills` service resolves the wait without
 *   running the callback, so success is decided by what the callback recorded,
 *   never by "the await returned";
 * - **off → on really comes back**: the registry silently drops a same-name
 *   registration from a second fiber, so the previous set must be disposed
 *   (and awaited) before the next is installed;
 * - **idempotence**: the lifecycle hook, the panel and the tool all call
 *   `ensureAgent`, and a repeat with an unchanged selection must be free;
 * - **serialized flips**: two toggles in a row must not interleave, or the
 *   loser's registration is swallowed and its handle leaked.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import {
  applyToAgent, buildSkillQueryTool, buildSkillSelectTool, SkillBindings, withoutMissing, writeSelection,
} from '../src/features/context/index.ts'

import type { AgentLike } from '../src/features/context/index.ts'
import type { SkillsManager } from '../src/features/skills/index.ts'
import type { SkillSummary } from '../src/shared/protocol/index.ts'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

interface FakeAgent { id: string }

let globalCtx: Context
let registry: SkillRegistry

beforeEach(() => {
  globalCtx = new Context()
  registry = new SkillRegistry(globalCtx)
})

afterEach(() => {
  globalCtx = undefined as unknown as Context
})

function registration(name: string): SkillRegistration {
  return { name, description: 'bound by test', content: 'body', source: 'runtime' }
}

/** Names one agent currently sees through the engine. */
async function visible(agent: FakeAgent): Promise<string[]> {
  return (await registry.list({ scope: agent })).map((s) => s.name).sort()
}

describe('SkillBindings', () => {
  it('installs a selection into that conversation alone', async () => {
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    const outcome = await bindings.apply(agent, scope.ctx, [registration('gsap')])

    expect(outcome.applied).toBe(true)
    expect(outcome.registered).toEqual(['gsap'])
    expect(await visible(agent)).toEqual(['gsap'])
    expect(await registry.list()).toEqual([])
    await bindings.releaseAll()
  })

  it('reports applied:false when the skills service is not reachable', async () => {
    // The silent-lie scenario: awaiting the fiber succeeds, the callback never
    // runs. Reporting success here would tell the panel a skill is on while the
    // agent sees nothing.
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const withoutSkills = createScope(new Context(), agent)

    const outcome = await bindings.apply(agent, withoutSkills.ctx, [registration('gsap')])

    expect(outcome.applied).toBe(false)
    expect(outcome.error).toMatch(/skills/)
    expect(bindings.isApplied(agent)).toBe(false)
    await bindings.releaseAll()
  })

  it('off → on really comes back (the same-name guard must not swallow it)', async () => {
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    await bindings.apply(agent, scope.ctx, [registration('gsap')])
    expect(await visible(agent)).toEqual(['gsap'])

    // Off.
    await bindings.apply(agent, scope.ctx, [])
    expect(await visible(agent)).toEqual([])

    // On again — the registration must be real, not a no-op the registry
    // dropped because a previous layer still held the name.
    const again = await bindings.apply(agent, scope.ctx, [registration('gsap')])
    expect(again.applied).toBe(true)
    expect(await visible(agent)).toEqual(['gsap'])
    await bindings.releaseAll()
  })

  it('replaces a selection without leaving the old one behind', async () => {
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    await bindings.apply(agent, scope.ctx, [registration('old-a'), registration('old-b')])
    await bindings.apply(agent, scope.ctx, [registration('new')])

    expect(await visible(agent)).toEqual(['new'])
    await bindings.releaseAll()
  })

  it('is idempotent: the same selection twice disturbs nothing', async () => {
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)
    const wanted = [registration('gsap')]

    const first = await bindings.ensureAgent(agent, scope.ctx, wanted)
    const second = await bindings.ensureAgent(agent, scope.ctx, wanted)

    expect(first.applied).toBe(true)
    expect(second.applied).toBe(true)
    // One registration, not two: the second call reused the binding.
    expect(await visible(agent)).toEqual(['gsap'])
    await bindings.releaseAll()
  })

  it('serializes overlapping flips so the last one wins', async () => {
    const bindings = new SkillBindings()
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    // Two flips in flight at once: without the queue the second inject would
    // find the first set installed and have its registration dropped.
    await Promise.all([
      bindings.apply(agent, scope.ctx, [registration('first')]),
      bindings.apply(agent, scope.ctx, [registration('second')]),
    ])

    expect(await visible(agent)).toEqual(['second'])
    await bindings.releaseAll()
  })

  it('releaseAll clears every conversation', async () => {
    const bindings = new SkillBindings()
    const one: FakeAgent = { id: 'session-1' }
    const two: FakeAgent = { id: 'session-2' }
    const scopeOne = createScope(globalCtx, one)
    const scopeTwo = createScope(globalCtx, two)

    await bindings.apply(one, scopeOne.ctx, [registration('a')])
    await bindings.apply(two, scopeTwo.ctx, [registration('b')])
    await bindings.releaseAll()

    expect(await registry.list()).toEqual([])
    expect(await visible(one)).toEqual([])
    expect(await visible(two)).toEqual([])
  })
})

/**
 * `applyToAgent` — which selection reaches the agent.
 *
 * The panel computes the new selection and then asks for it to be applied; the
 * file still holds the old one until the apply succeeds. Reading the file here
 * made the panel install the *previous* set, answer `applied: true` (the names
 * had not changed, so the idempotent short-circuit fired) and only then write
 * the new file — a flip that silently did nothing while the UI claimed it
 * worked. The lifecycle hook passes nothing, and still means "the file".
 */
/** Captures what the engine handed to the bindings, and claims success. */
function spyBindings(captured: SkillRegistration[][]): SkillBindings {
  return {
    async ensureAgent(_agent, _ctx, registrations) {
      captured.push(registrations)
      return { applied: true, registered: registrations.map((r) => r.name), missing: [] }
    },
  } as unknown as SkillBindings
}

/** A manager that resolves every slug except `ghost`, and lists two rows. */
function spyManager(): SkillsManager {
  return {
    resolveRegistration(slug: string) {
      return slug === 'ghost' ? undefined : registration(slug)
    },
    enableBlocker: () => undefined,
    listSkills: () => ([
      { name: 'ghost', description: 'unresolvable', group: 'native', linked: false, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'x' },
      { name: 'planned', description: 'resolvable', group: 'stored', linked: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'y', slug: 'planned' },
    ] satisfies SkillSummary[]),
  } as unknown as SkillsManager
}

/** A workspace of its own, so a persisted selection never lands in the repo. */
function tempWorkspace(): string {
  const dir = join(tmpdir(), 'dsh-tool-test-' + Math.random().toString(36).slice(2))
  mkdirSync(join(dir, '.git'), { recursive: true })
  return dir
}

describe('applyToAgent selection source', () => {
  it('applies the selection it is handed, not the one still in the file', async () => {
    const captured: SkillRegistration[][] = []
    const agent = { id: 'session-1' } as unknown as AgentLike

    await applyToAgent(spyManager(), spyBindings(captured), agent, {
      sessionId: 'session-1', selected: ['planned'], updatedAt: '',
    })

    // The *handed* selection is what gets published, not the file's.
    expect(captured[0].map((r) => r.name)).toEqual(['planned'])
  })

  it('falls back to the file when nothing is handed over (lifecycle hook)', async () => {
    const workspace = join(tmpdir(), 'dsh-apply-test-' + Math.random().toString(36).slice(2))
    mkdirSync(join(workspace, '.git'), { recursive: true })
    writeSelection(workspace, { sessionId: 'session-1', selected: ['from-file'], updatedAt: '' })
    const captured: SkillRegistration[][] = []
    const agent = {
      id: 'session-1', session: { header: { cwd: workspace } },
    } as unknown as AgentLike

    await applyToAgent(spyManager(), spyBindings(captured), agent)

    expect(captured[0].map((r) => r.name)).toEqual(['from-file'])
    rmSync(workspace, { recursive: true, force: true })
  })

  it('drops the slugs nothing can resolve from the selection', () => {
    const selection = { sessionId: 's', selected: ['real', 'ghost'], updatedAt: '' }
    expect(withoutMissing(selection, ['ghost']).selected).toEqual(['real'])
    // Nothing to drop keeps the very same object, so callers can compare by
    // identity.
    expect(withoutMissing(selection, [])).toBe(selection)
  })
})

/** The slice of `skill_query`'s answer these tests read. */
interface QueryAnswer {
  workspace: string
  total: number
  skills: Array<{ name: string; linked: boolean; selected: boolean; usable: boolean; reason?: string }>
}

/**
 * The discovery channel: `skill_query`.
 *
 * The catalog only lists what is linked, so a stored-but-unlinked skill is
 * invisible to the model until it is enabled — and the model had no way to ask.
 * The answer is computed **at call time** and returned as plain JSON, rather
 * than shipped as a loadable pseudo-skill the model has to run a command for.
 */
describe('skill_query', () => {
  /** Two rows: one enableable, one container that has no body to load. */
  function queryManager(): SkillsManager {
    return {
      listSkills: () => ([
        { name: 'planned', description: 'resolvable', group: 'stored', linked: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'y', slug: 'planned' },
        { name: 'apple', description: 'a container', group: 'native', linked: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'z', slug: 'apple' },
      ] satisfies SkillSummary[]),
      enableBlocker: (slug: string) => (
        slug === 'apple' ? '该条目是容器目录（只有 DESCRIPTION.md，没有可加载的正文）' : undefined
      ),
    } as unknown as SkillsManager
  }

  it('answers with live state: linked, selected, and why a row is unusable', async () => {
    const workspace = tempWorkspace()
    writeSelection(workspace, { sessionId: 'session-1', selected: ['planned'], updatedAt: '' })
    const tool = buildSkillQueryTool(queryManager())
    const agent = { id: 'session-1', session: { header: { cwd: workspace } } } as unknown as AgentLike

    const answer = await tool.execute({}, { agent } as never) as QueryAnswer

    expect(answer.workspace).toBe(workspace)
    expect(answer.total).toBe(2)
    expect(answer.skills.find((s) => s.name === 'planned')).toMatchObject({
      linked: true, selected: true, usable: true,
    })
    const container = answer.skills.find((s) => s.name === 'apple')
    expect(container?.selected).toBe(false)
    expect(container?.usable).toBe(false)
    expect(container?.reason).toContain('容器')
    rmSync(workspace, { recursive: true, force: true })
  })

  it('filters by keyword and by group', async () => {
    const workspace = tempWorkspace()
    const tool = buildSkillQueryTool(queryManager())
    const agent = { id: 'session-1', session: { header: { cwd: workspace } } } as unknown as AgentLike

    const byKeyword = await tool.execute({ query: 'CONTAINER' }, { agent } as never) as QueryAnswer
    expect(byKeyword.skills.map((s) => s.name)).toEqual(['apple'])
    const byGroup = await tool.execute({ group: 'stored' }, { agent } as never) as QueryAnswer
    expect(byGroup.skills.map((s) => s.name)).toEqual(['planned'])
    rmSync(workspace, { recursive: true, force: true })
  })
})

/**
 * The model's own path: `skill_select` — the flip, and the one row type that
 * cannot be flipped usefully.
 */
describe('skill_select', () => {
  it('publishes exactly the selection the model asked for', async () => {
    const captured: SkillRegistration[][] = []
    const workspace = tempWorkspace()
    const tool = buildSkillSelectTool(spyManager(), spyBindings(captured))
    const agent = { id: 'session-1', session: { header: { cwd: workspace } } } as unknown as AgentLike

    await tool.execute({ slug: 'planned', selected: true }, { agent } as never)

    expect(captured[0].map((r) => r.name)).toEqual(['planned'])
    rmSync(workspace, { recursive: true, force: true })
  })

  it('refuses a container row and says where the real skills are', async () => {
    const captured: SkillRegistration[][] = []
    // A container admits by DESCRIPTION.md alone: it has a description to list
    // and nothing to load, and its real skills live one level below where dsh
    // never scans. Accepting the flip produced a dead catalog line while those
    // skills stayed unreachable.
    const container: SkillsManager = {
      resolveRegistration: (slug: string) => (slug === 'apple' ? registration('apple') : undefined),
      enableBlocker: (slug: string) => (slug === 'apple' ? '该条目是容器目录（只有 DESCRIPTION.md，没有可加载的正文）' : undefined),
      listSkills: () => [],
    } as unknown as SkillsManager
    const tool = buildSkillSelectTool(container, spyBindings(captured))
    const agent = { id: 'session-1' } as unknown as AgentLike

    const result = await tool.execute({ slug: 'apple', selected: true }, { agent } as never) as {
      applied: boolean
      error: string
    }

    expect(result.applied).toBe(false)
    expect(result.error).toContain('容器')
    // Never even attempted an install.
    expect(captured.length).toBe(0)
  })
})
