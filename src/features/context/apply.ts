/**
 * Live bindings: which skills each conversation currently sees.
 *
 * The context engine's whole claim is "this conversation sees exactly the
 * skills it picked". Making that true at runtime means installing a runtime
 * registration into *the agent's own context layer*, which cordis only allows
 * through a context that declares the service:
 *
 * ```ts
 * agent.ctx.inject(['skills'], (scope) => { scope.skills.register(reg) })
 * ```
 *
 * Accessing `agent.ctx.skills` directly throws
 * `cannot get property "skills" without inject` — the agent's context is a
 * plugin fiber and `skills` is not in its inject list. The injected child
 * context keeps the agent's scope tag (`extend` is prototypal), so the
 * registration still lands in that agent's private layer and nowhere else.
 *
 * Three properties of cordis make this delicate, and each one is handled here:
 *
 * 1. **`await fiber` is not proof the callback ran.** A fiber whose injected
 *    service is missing has no `inertia` at all, so `await` resolves
 *    immediately *and successfully* while the callback never executes. So the
 *    callback itself records what it registered, and {@link ApplyOutcome} is
 *    derived from that record — never from the fact that the wait returned.
 * 2. **The registry drops a duplicate name.** `skills.register` warns and
 *    returns a no-op disposer when the name is already in the target layer, so
 *    a second fiber for the same agent would be silently ignored and the real
 *    registration would belong to a handle nobody holds. Hence: dispose the
 *    previous binding before injecting, and never drop a handle on failure.
 * 3. **Registrations live on the fiber.** `skills.register` files its undo
 *    through `ctx.effect` on the calling context, so disposing the injected
 *    fiber is what removes them — which is exactly what {@link release} does.
 * @module
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/**
 * How long one apply waits for its fiber to settle.
 *
 * This guards exactly one failure: a `_reload()` that never finishes (its
 * `inertia` stays pending). It is **not** a missing-dependency detector — that
 * case returns instantly, and is caught by the effect assertion instead.
 */
const SETTLE_TIMEOUT_MS = 2_000

/** Reported when the injected callback never ran: `skills` never showed up. */
const ERROR_UNAVAILABLE = 'skills 服务不可用（未注册任何技能）'

/** Outcome of one apply, exactly as the routes and the tool report it. */
export interface ApplyOutcome {
  /** True only when the registrations really happened — never "probably". */
  applied: boolean
  /** Why not, when `applied` is false. */
  error?: string
  /** Skill names now registered for this conversation. */
  registered: string[]
  /** Slugs the selection named that nothing could resolve. */
  missing: string[]
}

/** One agent's injected plugin, plus the proof that its callback ran. */
interface Binding {
  /** The handle `ctx.inject` returned, kept from the instant it exists. */
  fiber: ReturnType<Context['inject']>
  /** The names the callback registers — compared to spot a changed selection. */
  wanted: string[]
  /**
   * Filled in **by the injected callback**. Its presence is the only evidence
   * that the callback ran, and therefore the only honest basis for `applied`.
   */
  done?: string[]
}

/** Wait for a fiber to settle, giving up after `ms` (see the constant's note). */
function settleWithin(fiber: PromiseLike<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('注入等待超时')) }, ms)
    Promise.resolve(fiber).then(
      () => { clearTimeout(timer); resolve() },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))) },
    )
  })
}

/** Same names, same order-insensitive set. */
function sameNames(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const seen = new Set(left)
  return right.every((name) => seen.has(name))
}

/**
 * The per-conversation registrations this plugin owns.
 *
 * One instance per plugin mount (held by the composition root): module-level
 * state would leak between tests and between plugin reloads.
 */
export class SkillBindings {
  /**
   * The shadow `skill` tool, when the takeover is on: installed inside the
   * same injected fiber as the registrations, so installing and uninstalling
   * a set also installs and uninstalls the tool. Its agent-scoped same-name
   * registration is what turns dsh's own catalog off (definition identity,
   * see `features/context/shadow.ts`).
   */
  private readonly shadowTool: ToolDefinition | undefined

  constructor(options: { shadowTool?: ToolDefinition } = {}) {
    this.shadowTool = options.shadowTool
  }

  /** One binding per agent identity; only ever grows until it is released. */
  private readonly live = new Map<object, Binding>()
  /** Tail of the per-agent job queue, so two flips never interleave. */
  private readonly queues = new Map<object, Promise<unknown>>()

  /**
   * Run `work` after every earlier job for the same agent.
   *
   * Two panel flips in quick succession must not overlap: the second inject
   * would find the first set still installed and have its registration dropped
   * as a duplicate.
   */
  private enqueue<T>(key: object, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve()
    const next = previous.then(work, work)
    this.queues.set(key, next.then(() => {}, () => {}))
    return next
  }

  /** True when this agent already holds a *really registered* set. */
  isApplied(agentKey: object): boolean {
    return this.live.get(agentKey)?.done !== undefined
  }

  /**
   * Make one agent's registrations match `registrations`.
   *
   * Idempotent: the lifecycle hook, the panel and the tool all call it, and a
   * repeat with the same set must not disturb a binding that already works.
   */
  async ensureAgent(
    agentKey: object,
    agentCtx: Context,
    registrations: SkillRegistration[],
    missing: string[] = [],
  ): Promise<ApplyOutcome> {
    const binding = this.live.get(agentKey)
    if (binding !== undefined && binding.done !== undefined
      && sameNames(binding.wanted, registrations.map((r) => r.name))) {
      return { applied: true, registered: binding.done, missing }
    }
    return this.apply(agentKey, agentCtx, registrations, missing)
  }

  /** Install `registrations` for one agent, replacing whatever was there. */
  async apply(
    agentKey: object,
    agentCtx: Context,
    registrations: SkillRegistration[],
    missing: string[] = [],
  ): Promise<ApplyOutcome> {
    const wanted = registrations.map((registration) => registration.name)
    return this.enqueue(agentKey, async () => {
      const existing = this.live.get(agentKey)
      if (existing !== undefined) {
        // Still waiting for `skills` and the set has not changed → reuse the
        // handle. Injecting a second one would register the same names, and the
        // registry silently ignores the loser (returning an empty disposer).
        if (existing.done === undefined && sameNames(existing.wanted, wanted)) {
          return this.settle(existing, missing)
        }
        await this.drop(agentKey, existing)
      }
      // Nothing to publish is a successful apply: the conversation simply sees
      // no engine-managed skill, and any previous set has just been removed.
      // The shadow tool, though, is not part of the set — it must survive this
      // branch, or an empty selection would hand the catalog back to dsh.
      if (registrations.length === 0 && this.shadowTool === undefined) {
        return { applied: true, registered: [], missing }
      }

      // The holder is created *before* `inject`: when the dependency is already
      // available the callback can run synchronously inside that call.
      const binding: Binding = { fiber: undefined as never, wanted }
      binding.fiber = agentCtx.inject(
        this.shadowTool === undefined ? ['skills'] : ['skills', 'tools'],
        (scope) => {
          for (const registration of registrations) scope.skills.register(registration)
          // Same fiber, same undo: disposing the set disposes the shadow, and
          // the agent-scoped same-name registration is what silences dsh's
          // own catalog.
          if (this.shadowTool !== undefined) scope.tools.register(this.shadowTool)
          // The one line that makes `applied` honest.
          binding.done = [...wanted]
        },
      )
      // Register the handle *before* awaiting: a handle dropped on a failure
      // would let the next call inject a second fiber for the same agent, and
      // its registration would be swallowed as a duplicate.
      this.live.set(agentKey, binding)
      return this.settle(binding, missing)
    })
  }

  /** Wait for one binding, then assert that it really registered. */
  private async settle(binding: Binding, missing: string[]): Promise<ApplyOutcome> {
    try {
      await settleWithin(binding.fiber, SETTLE_TIMEOUT_MS)
    } catch (error) {
      return { applied: false, error: (error as Error).message, registered: [], missing }
    }
    if (binding.done === undefined) {
      // The wait returned but the callback never ran: the injected service is
      // missing. Reporting success here is the BUG-2/BUG-3 lie in a new place.
      return { applied: false, error: ERROR_UNAVAILABLE, registered: [], missing }
    }
    return { applied: true, registered: binding.done, missing }
  }

  /** Dispose one binding and forget it — dispose first, forget second. */
  private async drop(agentKey: object, binding: Binding): Promise<void> {
    try {
      await settleWithin(binding.fiber, SETTLE_TIMEOUT_MS)
    } catch { /* a fiber that never activated has nothing to unload */ }
    try {
      await binding.fiber.dispose()
    } catch { /* already gone */ }
    // Only forget it once disposal finished: a caller arriving mid-disposal
    // must still see the handle, or it would inject a competing one.
    if (this.live.get(agentKey) === binding) this.live.delete(agentKey)
  }

  /** Drop one agent's registrations (its conversation is gone). */
  async release(agentKey: object): Promise<void> {
    return this.enqueue(agentKey, async () => {
      const binding = this.live.get(agentKey)
      if (binding !== undefined) await this.drop(agentKey, binding)
    })
  }

  /** Drop every binding — the plugin is unloading. */
  async releaseAll(): Promise<void> {
    await Promise.all([...this.live.keys()].map((key) => this.release(key)))
    this.queues.clear()
  }
}
