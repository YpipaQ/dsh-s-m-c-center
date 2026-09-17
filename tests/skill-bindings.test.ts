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
import { SkillBindings } from '../src/features/context/index.ts'

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
