/**
 * The `/mcp` route family.
 *
 * Note the shape every mutating route shares: change the document, then
 * `await mcp.sync(...)`. The sync is not optional — archiving a server has to
 * actually disconnect it, and the two documents are the only source of truth
 * for what should be running.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { McpManager } from './manager.ts';
/** Build the MCP route table. */
export declare function mcpRoutes(mcp: McpManager): WebRoute[];
//# sourceMappingURL=routes.d.ts.map