/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * The workspace is resolved in a deliberate order: the live agent's own cwd
 * first (so a panel call from a running conversation lands in *that*
 * conversation's workspace even without an explicit cwd), then the request's
 * `cwd`, then the project root above it.
 *
 * A toggle also re-applies to the live agent when one is registered. That is
 * why the failure of the apply is reported alongside a 200: the selection did
 * persist, and the user needs to know the running conversation did not pick it
 * up.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { AgentLike } from './tools.ts';
/** What the context routes need from the host. */
export interface ContextRouteDeps {
    /**
     * Live agent registry, when the host provides one: flipping a switch in the
     * panel applies immediately to a running conversation through it.
     */
    agents?: {
        get(id: string): AgentLike | undefined;
    };
    /** Applied after a panel toggle for a live conversation. */
    applyToAgent?: (agent: AgentLike) => void;
}
/** Build the contexts route table. */
export declare function contextRoutes(deps: ContextRouteDeps): WebRoute[];
//# sourceMappingURL=routes.d.ts.map