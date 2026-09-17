/**
 * C+ prototype verification (phase-two step 0): does a registration made
 * through an agent-scoped context really land in that agent's private layer?
 *
 * The whole per-conversation selection design rests on one claim: from
 * `agent.ctx`, `ctx.skills.register(...)` files into the agent's scope layer,
 * so the official catalog — which the agent reads with `scope: agent` — shows
 * exactly the chosen skills, while every other conversation sees nothing.
 * These tests pin that claim with the real `@deepseek-ai/dsh-skill` registry
 * and the real `@deepseek-ai/dsh-scope` primitive, no mocks.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope } from '@deepseek-ai/dsh-scope'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/** One fake agent scope key (in production this is the Agent instance). */
interface FakeAgent { id: string }

let globalCtx: Context

beforeEach(() => {
  globalCtx = new Context()
})

afterEach(() => {
  // Registries are in-memory; the per-test Context is dropped with the test.
  globalCtx = undefined as unknown as Context
})

/** A minimal runtime registration, as the context engine would build it. */
function registration(name: string, body: string): SkillRegistration {
  return {
    name,
    description: 'registered by dsh-s-m-c-center for this conversation',
    content: body,
    source: 'runtime',
  }
}

describe('C+ prototype: per-agent skill registration', () => {
  it('agent-scoped register lands in the agent layer: the scoped catalog shows it, the global one does not', async () => {
    const registry = new SkillRegistry(globalCtx) // ctx.skills
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)
    const agentCtx = scope.ctx

    // Empty world: nothing in the global layer, nothing in the agent layer.
    expect(await registry.list()).toEqual([])
    expect(await registry.list({ scope: agent })).toEqual([])

    // The selection: one skill chosen for this conversation, registered
    // through the agent's own context.
    const dispose = agentCtx.skills.register(registration('chosen-skill', 'body of chosen'))
    expect(typeof dispose).toBe('function')

    // The agent's catalog now shows exactly the chosen skill…
    const seen = await registry.list({ scope: agent })
    expect(seen.map((s) => s.name)).toEqual(['chosen-skill'])
    // …and it is fully loadable through the official `get`.
    const loaded = await registry.get('chosen-skill', { scope: agent })
    expect(loaded?.content).toBe('body of chosen')
    expect(loaded?.invocation.modelInvocable).toBe(true)
    expect(loaded?.invocation.userInvocable).toBe(true)

    // A different conversation (another scope key) sees nothing.
    const other: FakeAgent = { id: 'session-2' }
    expect(await registry.list({ scope: other })).toEqual([])
    // The global layer (unscoped lookups) sees nothing either.
    expect(await registry.list()).toEqual([])
    expect(await registry.get('chosen-skill')).toBeUndefined()

    // Dispose → the skill disappears from that conversation too.
    dispose()
    expect(await registry.list({ scope: agent })).toEqual([])
    expect(await registry.get('chosen-skill', { scope: agent })).toBeUndefined()
  })

  it('two conversations can hold different selections at the same time', async () => {
    const registry = new SkillRegistry(globalCtx)
    const a: FakeAgent = { id: 'session-a' }
    const b: FakeAgent = { id: 'session-b' }
    const scopeA = createScope(globalCtx, a)
    const scopeB = createScope(globalCtx, b)

    const disposeA = scopeA.ctx.skills.register(registration('skill-a', 'a body'))
    const disposeB = scopeB.ctx.skills.register(registration('skill-b', 'b body'))

    expect((await registry.list({ scope: a })).map((s) => s.name)).toEqual(['skill-a'])
    expect((await registry.list({ scope: b })).map((s) => s.name)).toEqual(['skill-b'])

    // Swapping one conversation's selection leaves the other untouched.
    disposeA()
    scopeA.ctx.skills.register(registration('skill-a2', 'a2 body'))
    expect((await registry.list({ scope: a })).map((s) => s.name)).toEqual(['skill-a2'])
    expect((await registry.list({ scope: b })).map((s) => s.name)).toEqual(['skill-b'])

    disposeB()
  })

  it('selection survives a scope chain: a preset-style parent layer stays visible to the child', async () => {
    const registry = new SkillRegistry(globalCtx)
    // Simulate the preset standing scope as the parent of an agent scope.
    // The parent link is explicit (bindScopeParent, via CreateScopeOptions).
    const preset: FakeAgent = { id: 'preset-standard' }
    const agent: FakeAgent = { id: 'session-1' }
    const presetScope = createScope(globalCtx, preset)
    const agentScope = createScope(presetScope.ctx, agent, { parent: preset })

    // A skill registered at the preset layer is inherited by the agent…
    presetScope.ctx.skills.register(registration('preset-skill', 'from preset'))
    expect((await registry.list({ scope: agent })).map((s) => s.name)).toEqual(['preset-skill'])
    // …and the agent can add its own on top; both are visible.
    agentScope.ctx.skills.register(registration('session-skill', 'from session'))
    expect((await registry.list({ scope: agent })).map((s) => s.name).sort())
      .toEqual(['preset-skill', 'session-skill'])
  })

  it('registering the same name twice in one layer is first-wins (the loser gets a no-op disposer)', async () => {
    const registry = new SkillRegistry(globalCtx)
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    const first = scope.ctx.skills.register(registration('dup', 'first body'))
    const second = scope.ctx.skills.register(registration('dup', 'second body'))
    const loaded = await registry.get('dup', { scope: agent })
    expect(loaded?.content).toBe('first body')

    // Disposing the loser must not remove the winner.
    second()
    expect(await registry.get('dup', { scope: agent })).toBeDefined()
    first()
    expect(await registry.get('dup', { scope: agent })).toBeUndefined()
  })
})
