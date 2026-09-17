/**
 * The two MCP documents and the definition shape they hold.
 *
 * A definition is *active* while it sits in `mcp.json` and *archived* while it
 * sits in `mcp-archive.json`. `enabled: false` is not a third state — it is the
 * hand-edited spelling of "archived", which `migrateArchive()` folds away at
 * startup so that from then on "not active" has exactly one representation:
 * absent from the active document.
 *
 * Both documents are hand-editable, so every read path treats them as hostile:
 * a missing, blank or corrupt file reads as "no servers" instead of throwing,
 * and every write path re-normalizes the record it is about to persist.
 * @module
 */
import * as mcpClient from '@deepseek-ai/dsh-mcp-client';
import type { McpArchive, McpServerConfig } from '../../shared/protocol/index.ts';
/** Schema version stamped on the archive document. */
export declare const ARCHIVE_VERSION: 1;
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
/** Translate a persisted definition into the client plugin's config. */
export declare function toMcpClientConfig(s: McpServerConfig): mcpClient.Config;
/**
 * Whether two definitions would produce the same connection.
 *
 * Compared field by field rather than as one JSON blob: key order is not part
 * of the config, so it must not decide a reconnect.
 */
export declare function sameShape(a: McpServerConfig, b: McpServerConfig): boolean;
/** The same list without `name`. */
export declare function without(list: McpServerConfig[], name: string): McpServerConfig[];
/** Replace the same-named entry where it sits, or append when it is new. */
export declare function upsert(list: McpServerConfig[], entry: McpServerConfig): McpServerConfig[];
//# sourceMappingURL=document.d.ts.map