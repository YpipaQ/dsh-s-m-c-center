/**
 * The `/contexts` route family — per-conversation skill selection.
 *
 * Selections live in one **relay table** (`$STORE_ROOT/contexts.json`, see
 * `./table.ts`), keyed by session id. Nothing here resolves a workspace any
 * more, and that removed two failures at once:
 *
 * - the `cwd required` 400, which fired for every request about a conversation
 *   that was not currently running — nothing could say which workspace it
 *   belonged to, so the panel refused to act;
 * - the settings page and the sidebar reading *two different files* (the page
 *   resolved the workspace dsh reports, the sidebar the one the conversation
 *   runs in), which is how one switch could show two answers.
 *
 * A toggle applies to the live agent **before** it persists. The order is the
 * point: persisting first means a failed apply leaves a row (and a panel)
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
     * hands over the selection it just planned — reading the table here instead
     * applied one flip behind. Resolves with what really happened; the route
     * persists only when `applied` is true.
     */
    applyToAgent?: (agent: AgentLike, selection: ContextSelection) => Promise<ApplyOutcome>;
}
/** Build the contexts route table. */
export declare function contextRoutes(deps: ContextRouteDeps): WebRoute[];
//# sourceMappingURL=routes.d.ts.map