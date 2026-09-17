/**
 * The /api/dsh-s-m-c-center route family — the browser half's only data path.
 *
 * This module owns nothing but the assembly: it collects the per-feature route
 * tables into the one list the host registers. Each feature's own `routes.ts`
 * holds its handlers, and the shared trust fence they all sit behind
 * (loopback-only, with browser same-origin markers) lives in `shared/http.ts`.
 *
 * Reading this file should tell you what the plugin exposes, not how any of it
 * works — that is the split the feature directories are for.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { ManagerSettings } from './shared/protocol/index.ts';
import type { SkillsManager } from './features/skills/index.ts';
import type { McpManager } from './features/mcp/index.ts';
import type { CliManager } from './features/cli/index.ts';
import type { AgentLike, ApplyOutcome } from './features/context/index.ts';
export interface RoutesDeps {
    skills: SkillsManager;
    mcp: McpManager;
    cli: CliManager;
    /**
     * Live agent registry, when the host provides one: flipping a switch in the
     * panel applies immediately to a running conversation through it.
     */
    agents?: {
        get(id: string): AgentLike | undefined;
    };
    /**
     * Apply one live conversation's selection. Resolves with what really
     * happened — the context route persists only when `applied` is true.
     */
    applyToAgent?: (agent: AgentLike) => Promise<ApplyOutcome>;
    /** Read the plugin's own persisted settings (~/.dsh/settings.yaml block). */
    readOwnSettings: () => ManagerSettings;
    /** Persist new settings, then re-apply surfaces; returns what landed. */
    writeOwnSettings: (next: ManagerSettings) => ManagerSettings;
}
/**
 * Build every /api/dsh-s-m-c-center route (exact paths).
 * @param deps - skills engine, MCP connection manager, and CLI manager.
 * @returns the route registrations.
 */
export declare function makeRoutes(deps: RoutesDeps): {
    routes: WebRoute[];
};
//# sourceMappingURL=routes.d.ts.map