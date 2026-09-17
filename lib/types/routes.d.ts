/**
 * The /api/dsh-s-m-c-center route family — the browser half's only data path.
 * Skills CRUD, MCP CRUD (plus a one-shot connection test), the local CLI
 * registry, and the plugin's own settings block. Every route sits behind a
 * loopback-only trust fence with browser same-origin markers: these endpoints
 * read and write user files and spawn MCP servers, so a LAN-exposed dsh web
 * deployment must not serve them.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { CliManager } from './cli.ts';
import { McpManager } from './mcp.ts';
import { SkillsManager } from './skills.ts';
import type { ManagerSettings } from './protocol.ts';
export interface RoutesDeps {
    skills: SkillsManager;
    mcp: McpManager;
    cli: CliManager;
    /**
     * Live agent registry, when the host provides one: flipping a switch in the
     * panel applies immediately to a running conversation through it.
     */
    agents?: {
        get(id: string): {
            id: string;
            ctx: unknown;
            session?: {
                header?: {
                    cwd?: string;
                };
            };
        } | undefined;
    };
    /** Applied after a panel toggle for a live conversation (context engine). */
    applyToAgent?: (agent: {
        id: string;
        ctx: unknown;
        session?: {
            header?: {
                cwd?: string;
            };
        };
    }) => void;
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