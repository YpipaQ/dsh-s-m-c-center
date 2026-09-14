/**
 * The MCP half of the manager: two JSON documents on disk and the live
 * connections they describe.
 *
 * A definition is *active* while it sits in `mcp.json` and *archived* while it
 * sits in `mcp-archive.json`. Only active definitions are ever connected:
 * every enabled one gets its own `@deepseek-ai/dsh-mcp-client` fiber, and that
 * fiber's lifetime is the connection — disposing it disconnects and unregisters
 * the `mcp__<server>__<tool>` tools in one step. Archiving therefore means
 * "moved out of the active document", never "flagged off in place".
 *
 * Both documents are hand-editable, so every read path treats them as hostile:
 * a missing, blank or corrupt file reads as "no servers" instead of throwing,
 * and every write path re-normalizes the record it is about to persist.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import type { McpArchive, McpServerConfig, McpServerSummary } from './protocol.ts';
/** The active document: `$STORE_ROOT/mcp.json`. */
export declare function mcpConfigPath(): string;
/**
 * The archive document: `$STORE_ROOT/mcp-archive.json`.
 *
 * The MCP spelling of "not offered" — the same idea as a skill with no link in
 * its root, or a CLI switched to 隐藏. The definition survives untouched, but
 * because it no longer appears in the active document it is neither connected
 * nor announced.
 */
export declare function mcpArchivePath(): string;
/** The active document, as the rest of the plugin knows it. */
export declare function readMcpConfig(): {
    servers: McpServerConfig[];
};
/** Persist the active document. */
export declare function writeMcpConfig(data: {
    servers: McpServerConfig[];
}): void;
/** The archive document, always carrying the current schema version. */
export declare function readMcpArchive(): McpArchive;
/** Persist the archive document, stamping the schema version. */
export declare function writeMcpArchive(data: McpArchive): void;
/**
 * Check one definition coming in over the wire.
 * @returns `null` when acceptable, otherwise the reason to show the user.
 */
export declare function validateMcpServer(server: unknown): string | null;
/**
 * Put a definition into the exact shape that gets persisted.
 *
 * Only the fields the transport actually uses survive — a `url` left over from
 * switching a server to stdio would otherwise sit in `mcp.json` forever, and a
 * reused name would silently keep talking to the old endpoint.
 */
export declare function normalizeMcpServer(server: McpServerConfig): McpServerConfig;
/**
 * Owns every live mcp-client fiber, keyed by server name.
 *
 * The set is *converged*, not commanded: {@link sync} takes the desired list
 * and reconciles what is running against it, so the same call covers startup,
 * a toggle, an edit, and a plugin teardown.
 */
export declare class McpManager {
    private readonly ctx;
    private readonly live;
    private readonly notes;
    constructor(ctx: Context);
    /** Re-read the active document and converge onto it. */
    reload(): Promise<void>;
    /**
     * Make the live set match `servers` (enabled ones only).
     *
     * Two passes, planned before either acts: first everything that is running
     * but no longer wanted — removed, disabled, or edited into a different shape
     * — is torn down; then everything wanted without a fiber is brought up.
     */
    sync(servers: McpServerConfig[]): Promise<void>;
    /** Stop and dispose one connection, if it is running. */
    private drop;
    /** Tear every connection down (plugin teardown). */
    dispose(): Promise<void>;
    /**
     * Fold every `enabled: false` entry out of the active document into the
     * archive. Runs once at startup and is idempotent: after a pass the active
     * document has no disabled entries left to find. A hand-edited `enabled:
     * false` is picked up on the next start by design — "not active" has one
     * spelling now, and it is "absent from mcp.json".
     * @returns how many entries were found disabled.
     */
    migrateArchive(): number;
    /** Move one active definition into the archive (the caller then syncs). */
    archiveServer(name: string): void;
    /** Move one archived definition back into the active document. */
    activateServer(name: string): void;
    /**
     * Restore the whole archive at once — the uninstall page's MCP half.
     *
     * One write per document rather than a loop over {@link activateServer}.
     * There is deliberately no undo: a server put back can be archived again on
     * its own row whenever the user wants.
     * @returns how many definitions were restored.
     */
    activateAll(): number;
    /** Drop a definition from whichever document holds it. */
    deleteServer(name: string): void;
    /**
     * Persist a definition as active.
     *
     * Saving is how a row is enabled: an archived entry of the same name is
     * pulled out of the archive, and the active entry keeps its position in the
     * file when it already existed.
     */
    saveServer(server: McpServerConfig): McpServerConfig;
    /**
     * One-shot probe behind the "test connection" button: connect (with
     * failOnStartupError, so a bad server rejects instead of lingering), then
     * always dispose. Already-live servers answer ok immediately — a second
     * fiber would collide on the reserved serverName namespace.
     */
    testConnect(server: McpServerConfig): Promise<{
        ok: boolean;
        error?: string;
    }>;
    /**
     * Persisted definitions merged with live status, for the UI.
     * @param servers - entries from one document.
     * @param archived - true when they came from the archive: such rows are
     *   always reported inactive and stopped, whatever the live set says.
     */
    summarize(servers: McpServerConfig[], archived?: boolean): McpServerSummary[];
    /**
     * Snapshot of the active document plus live status.
     *
     * Safe to call from a prompt renderer: it only re-reads the file and merges
     * in-memory status — it never converges the live set, unlike {@link reload}.
     */
    current(): McpServerSummary[];
    /**
     * Active rows first, archived rows after, for the management list.
     *
     * The archived rows have to be there: without them, archiving a server would
     * remove the only row that could switch it back on.
     */
    listForUi(): McpServerSummary[];
}
//# sourceMappingURL=mcp.d.ts.map