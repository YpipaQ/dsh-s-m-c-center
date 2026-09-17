/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * The workspace is resolved in a deliberate order: the live agent's own cwd
 * first (so a panel call from a running conversation lands in *that*
 * conversation's workspace), then the request's `cwd`. When neither is
 * available the request is **refused** — the old fallback walked up from the
 * host process's own directory, which silently filed another workspace's
 * conversations under whatever directory dsh happened to be started in.
 *
 * A toggle applies to the live agent **before** it persists. The order is the
 * point: persisting first means a failed apply leaves a file (and a panel)
 * claiming a skill the agent cannot see. Only a successful apply is written.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { SkillsManager } from '../skills/index.ts';
import type { ApplyOutcome } from './apply.ts';
import type { ContextSelection } from './engine.ts';
import type { AgentLike } from './tools.ts';
/** What the context routes need from the host. */
export interface ContextRouteDeps {
    /** Resolves a selected slug, so a persist-only write never records a ghost. */
    skills: SkillsManager;
    /**
     * Live agent registry, when the host provides one: flipping a switch in the
     * panel applies immediately to a running conversation through it.
     */
    agents?: {
        get(id: string): AgentLike | undefined;
    };
    /**
     * Apply one live conversation's selection through `./apply.ts`. The route
     * hands over the selection it just planned — reading the file here instead
     * applied one flip behind. Resolves with what really happened; the route
     * persists only when `applied` is true.
     */
    applyToAgent?: (agent: AgentLike, selection: ContextSelection) => Promise<ApplyOutcome>;
}
/** Build the contexts route table. */
export declare function contextRoutes(deps: ContextRouteDeps): WebRoute[];
//# sourceMappingURL=routes.d.ts.map