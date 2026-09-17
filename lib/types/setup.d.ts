/**
 * Plugin identity and the host-facing constants.
 *
 * Kept in one place so the plugin id, its settings key, and the section order
 * it claims are visible together — those three are the values that must not
 * drift, because each one has an on-disk or cross-plugin consequence.
 * @module
 */
import z from 'schemastery';
/** Cordis plugin id. Renaming it breaks existing profiles — treat as fixed. */
export declare const name = "dsh-s-m-c-center";
/**
 * Services that must be present before any surface mounts. `settings` is
 * absent on purpose: the config section is attached later through
 * `ctx.inject`, so a host without a settings surface still gets routes + MCP.
 */
export declare const inject: string[];
/**
 * Key of this plugin's block in `~/.dsh/settings.yaml`.
 *
 * Written as a literal rather than imported so the browser half can spell the
 * same value without depending on a Host package. It stays a plain kebab-case
 * string because the `settingsNamespace()` branding helper was dropped from
 * `@deepseek-ai/dsh-settings` in DSH 0.1.2-alpha.2.
 */
export declare const SMC_NAMESPACE = "dsh-s-m-c-center";
/** Fields a user may put in that block. */
export interface Config {
    /** Master switch: routes, MCP connections and the prompt section. */
    enabled?: boolean;
    /** Whether to announce the plugin in every agent's system prompt. */
    announceToAgent?: boolean;
}
/** Schema form of the above, so dsh validates the block as it loads it. */
export declare const Config: z<Config>;
/** Fallbacks used until a config block has been written. */
export declare const DEFAULT_ENABLED = true;
export declare const DEFAULT_ANNOUNCE = true;
/** Where the announcement sits inside the tool-guidance band. */
export declare const SECTION_ORDER = 160;
/**
 * Workspace root for project-scoped discovery in the announcement.
 * Project-level skills live under the cwd, so the same plugin announces a
 * different skill set depending on where dsh is running.
 */
export declare function workspaceCwd(): string | undefined;
/**
 * Model-facing announcement: plugin presence, capabilities, and limits.
 *
 * Kept as the static form of the announcement and used as the fallback when the
 * live state cannot be read. The section normally renders the live
 * announcement instead, which splices in the actual skills, MCP servers and CLI
 * tools — see `src/features/announce/announce.ts` for why that matters.
 */
export declare const SMC_GUIDANCE = "\u672C\u673A\u88C5\u6709 dsh-s-m-c-center \u63D2\u4EF6\uFF08\u6280\u80FD/MCP/CLI \u7BA1\u7406\u5668\uFF0C\u8BBE\u7F6E\u9875\u300CWeb UI \u63D2\u4EF6 \u2192 \u5DE5\u5177\u7BA1\u7406\u300D\uFF09\u3002\u534F\u4F5C\u89C4\u5219\uFF1A1. \u65B0\u5EFA\u7528\u6237\u7EA7\u6280\u80FD \u2192 \u5199\u5230 ~/.dsh/S-M-C/skills/<\u540D>/\uFF08\u542B SKILL.md\uFF0Cfrontmatter \u9700 name+description\uFF09\uFF1B\u7981\u5199 ~/.dsh/skills\u3001~/.agents/skills \u7B49\u5E93\u5916\u76EE\u5F55\uFF1B\u5199\u5165\u540E\u4E3A\u300C\u672A\u542F\u7528\u300D\uFF0C\u7528\u6237\u542F\u7528\u540E\u53EF\u7528\uFF1B\u9879\u76EE\u4E13\u7528\u6280\u80FD\u653E\u5F53\u524D\u9879\u76EE\u7684 .dsh/skills/\u30022. \u6280\u80FD\u52A0\u8F7D\uFF1A\u4EC5\u7528 skill \u5DE5\u5177\u52A0\u8F7D\u5DF2\u542F\u7528\u6280\u80FD\u30023. MCP\uFF1A\u4EC5\u8C03\u5DF2\u8FDE\u63A5\u670D\u52A1\u5668\u7684 mcp__<server>__<tool>\uFF1B\u672A\u8FDE\u63A5/\u5F52\u6863\u4E0D\u53EF\u7528\uFF0C\u9700\u7528\u6237\u6FC0\u6D3B\u30024. \u672C\u5730 CLI\uFF08gh/git \u53CA skill \u5185\u5D4C scripts/run-cli \u5305\u88C5\u7684\uFF09\uFF1A\u7ECF\u7EC8\u7AEF\u6309\u540D\u8C03\u7528\uFF0C\u53EF\u62A5\u5B89\u88C5/\u7248\u672C/\u66F4\u65B0/API-Key/\u5B50\u547D\u4EE4\u72B6\u6001\uFF1B\u300C\u672A\u627E\u5230\u300D\u5148\u88C5\u30025. \u6280\u80FD\u5220\u9664\uFF1D\u7269\u7406\u5220\u9664\u4E0D\u53EF\u6062\u590D\uFF0C\u5148\u83B7\u7528\u6237\u786E\u8BA4\u30026. \u542F\u505C/\u589E\u5220\u5F52\u7528\u6237\u5728\u7BA1\u7406\u9875\u64CD\u4F5C\u3002\u6570\u636E\u5728 ~/.dsh/S-M-C\uFF08MCP \u51ED\u8BC1\u660E\u6587\uFF09\u3002\u63D0\u5230\u300C\u6280\u80FD\u7BA1\u7406 / \u6280\u80FD\u5BFC\u5165 / MCP \u670D\u52A1\u5668 / MCP \u8FDE\u63A5 / CLI \u5DE5\u5177 / CLI \u72B6\u6001\u300D\u5373\u6307\u672C\u63D2\u4EF6\u3002";
//# sourceMappingURL=setup.d.ts.map