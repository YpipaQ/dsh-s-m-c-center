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
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
/** Outcome of one apply, exactly as the routes and the tool report it. */
export interface ApplyOutcome {
    /** True only when the registrations really happened — never "probably". */
    applied: boolean;
    /** Why not, when `applied` is false. */
    error?: string;
    /** Skill names now registered for this conversation. */
    registered: string[];
    /** Slugs the selection named that nothing could resolve. */
    missing: string[];
}
/**
 * The per-conversation registrations this plugin owns.
 *
 * One instance per plugin mount (held by the composition root): module-level
 * state would leak between tests and between plugin reloads.
 */
export declare class SkillBindings {
    /**
     * The shadow `skill` tool, when the takeover is on: installed inside the
     * same injected fiber as the registrations, so installing and uninstalling
     * a set also installs and uninstalls the tool. Its agent-scoped same-name
     * registration is what turns dsh's own catalog off (definition identity,
     * see `features/context/shadow.ts`).
     */
    private readonly shadowTool;
    constructor(options?: {
        shadowTool?: ToolDefinition;
    });
    /** One binding per agent identity; only ever grows until it is released. */
    private readonly live;
    /** Tail of the per-agent job queue, so two flips never interleave. */
    private readonly queues;
    /**
     * Run `work` after every earlier job for the same agent.
     *
     * Two panel flips in quick succession must not overlap: the second inject
     * would find the first set still installed and have its registration dropped
     * as a duplicate.
     */
    private enqueue;
    /** True when this agent already holds a *really registered* set. */
    isApplied(agentKey: object): boolean;
    /**
     * Make one agent's registrations match `registrations`.
     *
     * Idempotent: the lifecycle hook, the panel and the tool all call it, and a
     * repeat with the same set must not disturb a binding that already works.
     */
    ensureAgent(agentKey: object, agentCtx: Context, registrations: SkillRegistration[], missing?: string[]): Promise<ApplyOutcome>;
    /** Install `registrations` for one agent, replacing whatever was there. */
    apply(agentKey: object, agentCtx: Context, registrations: SkillRegistration[], missing?: string[]): Promise<ApplyOutcome>;
    /** Wait for one binding, then assert that it really registered. */
    private settle;
    /** Dispose one binding and forget it — dispose first, forget second. */
    private drop;
    /** Drop one agent's registrations (its conversation is gone). */
    release(agentKey: object): Promise<void>;
    /** Drop every binding — the plugin is unloading. */
    releaseAll(): Promise<void>;
}
//# sourceMappingURL=apply.d.ts.map