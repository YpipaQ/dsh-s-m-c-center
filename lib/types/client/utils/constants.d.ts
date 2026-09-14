/**
 * Shared shapes and literals for the manager UI. Kept free of React and of the
 * API client so both the hooks layer and the view layer can import them without
 * creating a cycle.
 *
 * No copy lives here: labels are locale keys resolved by the caller with `t()`,
 * so an English shell never renders Chinese.
 */
import type { SkillsMcpKey } from '../locales.ts';
/** Editor payload for one MCP server: one flat record backing both UI modes. */
export interface McpForm {
    name: string;
    transport: 'stdio' | 'streamable-http';
    command: string;
    args: string;
    env: string;
    cwd: string;
    url: string;
    headers: string;
    mode: 'form' | 'json';
    json: string;
}
/** Fresh editor state — a new object per call so callers never share it. */
export declare function emptyMcpForm(): McpForm;
/** The four management surfaces, in tab order. */
export declare const TABS: readonly ["skills", "mcp", "cli", "uninstall"];
export type TabId = (typeof TABS)[number];
/** Tab captions as locale keys (bilingual through the plugin's dictionary). */
export declare const TAB_LABELS: Record<TabId, SkillsMcpKey>;
/** Skill enablement filter options for the list toolbar. */
export type EnabledFilter = 'all' | 'enabled' | 'disabled';
/** MCP server runtime status → locale key. */
export declare const MCP_STATUS_LABEL: Record<string, SkillsMcpKey>;
/**
 * The two states of a local CLI's announcement switch.
 *
 * A CLI is installed and run by the system — this plugin can neither start nor
 * stop it. The switch therefore controls exactly one thing: whether the CLI is
 * listed in the announcement handed to every agent (公告), or left out of it
 * (隐藏). Distinct from the plugin's own 「向 AI 公告」 switch, which announces
 * the plugin's capabilities rather than one tool.
 */
export declare const CLI_ANNOUNCE: {
    on: SkillsMcpKey;
    off: SkillsMcpKey;
};
/** Locale key for a CLI's announcement flag; absent or unrecognized → 隐藏. */
export declare function cliAnnounceLabel(advertised: boolean): SkillsMcpKey;
/**
 * The two states of an MCP server's availability switch.
 *
 * Same vocabulary as {@link CLI_ANNOUNCE}: 激活 means the definition lives in
 * ~/.dsh/S-M-C/mcp.json and is really connected; 归档 means it was moved to
 * ~/.dsh/S-M-C/mcp-archive.json, so it is never connected and never announced.
 * The definition itself is preserved either way — archiving is not deleting.
 */
export declare const MCP_ACTIVE: {
    active: SkillsMcpKey;
    archived: SkillsMcpKey;
};
/** Locale key for an MCP row's switch; a non-active row reads 归档. */
export declare function mcpActiveLabel(enabled: boolean): SkillsMcpKey;
//# sourceMappingURL=constants.d.ts.map