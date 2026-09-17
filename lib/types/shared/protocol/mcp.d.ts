/**
 * The MCP half of the wire contract: server definitions, live connection
 * state, and the archive document.
 * @module
 */
/** MCP transport kinds the manager supports. */
export type McpTransport = 'stdio' | 'streamable-http';
/** One persisted MCP server definition (a row of `mcp.json`). */
export interface McpServerConfig {
    /** Server name; also the namespace its tools register under. */
    name: string;
    transport: McpTransport;
    /** Absent counts as active — only an explicit `false` means archived. */
    enabled?: boolean;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    url?: string;
    headers?: Record<string, string>;
}
/** Connection state the manager reports for one server. */
export type McpConnectionStatus = 'connecting' | 'running' | 'failed' | 'stopped';
/**
 * One MCP server as returned to the UI (full config + live connection state).
 *
 * `enabled` is narrowed to a concrete boolean here: the host's `summarize()`
 * resolves the optional persisted flag (`enabled !== false`) before sending, so
 * the browser never has to treat "absent" and "true" as different states.
 */
export interface McpServerSummary extends Omit<McpServerConfig, 'enabled'> {
    enabled: boolean;
    status: McpConnectionStatus;
    error?: string;
    /**
     * True when the definition lives in `~/.dsh/S-M-C/mcp-archive.json` instead of the
     * active document. Archived servers are never connected and never announced;
     * `enabled` is false for them too, so a single switch still reads correctly.
     */
    archived: boolean;
}
/** Persisted archive document (`~/.dsh/S-M-C/mcp-archive.json`). */
export interface McpArchive {
    version: 1;
    servers: McpServerConfig[];
}
//# sourceMappingURL=mcp.d.ts.map