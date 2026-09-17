/**
 * The cordis facts the context engine's runtime half is built on.
 *
 * `agent.ctx.skills.register(...)` looks obvious and is wrong: the agent's
 * context is a plugin fiber, and reading a service it does not declare throws
 * `cannot get property "skills" without inject`. That was BUG-1 — the tool the
 * announcement tells the model to use failed on every real call, while these
 * tests passed, because they reach the service from an unguarded context.
 *
 * So this file pins the two halves of the correct pattern against the real
 * registry and the real scope primitive, and pins the trap that makes the
 * "obvious" version fail. The wait-then-assert rule lives in `SkillBindings`
 * and is pinned in `skill-bindings.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
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

describe('agent-context service access (the BUG-1 trap)', () => {
  it('throws when the context does not declare the service — the "obvious" call', () => {
    // No `skills` anywhere in this context's chain: the same guard production
    // hit, where the agent's fiber cannot see the service the plugin can.
    const scope = createScope(new Context(), { id: 'no-skills' })

    expect(() => scope.ctx.skills).toThrow(/without inject/)
    // …and the guard is not a typo detector: `inject` is the sanctioned way in.
    expect(() => scope.ctx.inject(['skills'], () => {})).not.toThrow()
  })

  it('lands the registration in the agent layer only, when done through inject', async () => {
    const registry = new SkillRegistry(globalCtx)
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)
    // The scope tag survives into the injected child: this is what keeps a
    // conversation's registrations out of every other conversation.
    expect(scopeOf(scope.ctx)).toBe(agent)

    await scope.ctx.inject(['skills'], (injected) => {
      injected.skills.register(registration('chosen', 'body'))
    })

    expect((await registry.list({ scope: agent })).map((s) => s.name)).toEqual(['chosen'])
    // Not global, and not visible to another conversation.
    expect(await registry.list()).toEqual([])
    expect(await registry.list({ scope: { id: 'session-2' } })).toEqual([])
  })

  it('removes them again when the injected fiber is disposed', async () => {
    const registry = new SkillRegistry(globalCtx)
    const agent: FakeAgent = { id: 'session-1' }
    const scope = createScope(globalCtx, agent)

    const fiber = scope.ctx.inject(['skills'], (injected) => {
      injected.skills.register(registration('temporary', 'body'))
    })
    await fiber
    expect((await registry.list({ scope: agent })).map((s) => s.name)).toEqual(['temporary'])

    await fiber.dispose()
    expect(await registry.list({ scope: agent })).toEqual([])
  })

  it('resolves the wait even when the service never appears, without running the callback', async () => {
    // The trap behind the effect assertion: a fiber whose dependency is missing
    // has no pending work, so awaiting it succeeds immediately while the
    // callback never executes. "The await returned" therefore proves nothing
    // about whether anything was registered.
    const scope = createScope(new Context(), { id: 'no-skills' })
    let ran = false

    await scope.ctx.inject(['skills'], () => { ran = true })

    expect(ran).toBe(false)
  })
})
