/**
 * Host half of dsh-s-m-c-center: three engines (skills on the
 * filesystem, MCP over real @deepseek-ai/dsh-mcp-client connections, the local
 * CLI registry), the /api/dsh-s-m-c-center route family the browser half drives,
 * and the system-prompt announcement.
 *
 * The browser half contributes a first-class settings PAGE — not a card inside
 * a group; see ./client/index.ts. Nothing here patches dsh: every surface is
 * assembled from published NPM packages.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Cordis plugin id. Renaming it breaks existing profiles — treat as fixed. */
export declare const name = "dsh-s-m-c-center";
/** Services that must be present before any surface mounts. `settings` is
 * absent on purpose: the config section is attached later through
 * `ctx.inject`, so a host without a settings surface still gets routes + MCP. */
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
/**
 * Model-facing announcement: plugin presence, capabilities, and limits.
 *
 * Kept as the static form of the announcement and used as the fallback when the
 * live state cannot be read. The section normally renders
 * {@link renderAnnouncement} instead, which splices in the actual skills, MCP
 * servers and CLI tools — see `src/announce.ts` for why that matters.
 */
export declare const SMC_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-s-m-c-center \u63D2\u4EF6\uFF08\u5DE5\u5177\u7BA1\u7406\uFF1A\u6280\u80FD / MCP / CLI \u7BA1\u7406\u5668\uFF09\uFF1A\u8BBE\u7F6E\u9875\u300CWeb UI \u63D2\u4EF6 \u2192 \u5DE5\u5177\u7BA1\u7406\u300D\u3002\u80FD\u529B\uFF1A\u6D4F\u89C8/\u542F\u7528/\u4E0D\u542F\u7528/\u5220\u9664/\u5BFC\u5165\u6280\u80FD\uFF08\u9879\u76EE\u7EA7 .dsh/skills\u3001.agents/skills \u4E0E\u7528\u6237\u7EA7 ~/.dsh/skills\u3001~/.agents/skills\uFF09\uFF1B\u7BA1\u7406 MCP \u670D\u52A1\u5668\uFF08stdio \u4E0E streamable-http\uFF0C\u6FC0\u6D3B/\u5F52\u6863\uFF09\uFF1B\u4EE5\u53CA\u672C\u5730 CLI \u5DE5\u5177\u6E05\u5355\u4E0E\u72B6\u6001\uFF08\u53D1\u73B0 skill \u5185\u5D4C\u7684 CLI \u5305\u88C5\u811A\u672C\u5982 scripts/run-cli\u3001\u4EE5\u53CA\u7CFB\u7EDF CLI \u5982 gh/git/tencent-news-cli\uFF0C\u62A5\u544A\u662F\u5426\u5B89\u88C5/\u7248\u672C/\u9700\u66F4\u65B0/\u5B50\u547D\u4EE4/API-Key \u72B6\u6001\uFF09\u3002MCP \u662F\u771F\u5B9E\u8FDE\u63A5\uFF1A\u6FC0\u6D3B\u7684\u670D\u52A1\u5668\u7ECF @deepseek-ai/dsh-mcp-client \u771F\u6B63\u8FDE\u63A5\u5E76\u628A\u5DE5\u5177\u6CE8\u518C\u4E3A mcp__<server>__<tool>\uFF0C\u6FC0\u6D3B/\u5F52\u6863\u4F1A\u5B9E\u9645\u8FDE\u63A5/\u65AD\u5F00\u3002\u6CE8\u518C\u65B0\u6280\u80FD\uFF1A\u4E3A\u7528\u6237\u65B0\u5EFA\u7528\u6237\u7EA7\u6280\u80FD\u65F6\uFF0C\u628A\u6280\u80FD\u6587\u4EF6\u5939\u76F4\u63A5\u521B\u5EFA\u5230 ~/.dsh/S-M-C/skills/<\u6280\u80FD\u540D>/\uFF08\u5185\u542B SKILL.md\uFF09\uFF0C\u4E0D\u8981\u5199\u5230 ~/.dsh/skills\u3001~/.agents/skills \u7B49\u50A8\u5B58\u5E93\u5916\u7684\u76EE\u5F55 \u2014\u2014 \u53EA\u6709\u50A8\u5B58\u5E93\u91CC\u7684\u6280\u80FD\u624D\u4F1A\u88AB\u7EDF\u4E00\u7BA1\u7406\uFF1B\u5199\u5165\u540E\u4F1A\u4EE5\u300C\u672A\u542F\u7528\u300D\u51FA\u73B0\u5728\u7BA1\u7406\u9875\uFF0C\u7528\u6237\u542F\u7528\u540E\u4F60\u5373\u53EF\u901A\u8FC7 skill \u5DE5\u5177\u52A0\u8F7D\uFF0C\u9879\u76EE\u4E13\u7528\u6280\u80FD\u4ECD\u653E\u5F53\u524D\u9879\u76EE\u7684 .dsh/skills/\u3002\u9650\u5236\uFF1A\u672C\u63D2\u4EF6\u7684\u6570\u636E\u7EDF\u4E00\u5B58 ~/.dsh/S-M-C\uFF08MCP \u6FC0\u6D3B mcp.json\u3001\u5F52\u6863 mcp-archive.json\u3001CLI \u6CE8\u518C\u8868 cli.json\uFF1B\u5BC6\u7801/env \u660E\u6587\u3001\u6743\u9650 0600 \u7531\u7528\u6237\u81EA\u884C\u4FDD\u8BC1\uFF09\uFF1B\u7528\u6237\u7EA7\u6280\u80FD\u6B63\u672C\u5728 ~/.dsh/S-M-C/skills\uFF0C\u542F\u7528/\u4E0D\u542F\u7528\u7B49\u4E8E\u5728 skills \u76EE\u5F55\u589E\u5220\u8054\u63A5\uFF08\u4E0D\u6539\u5199 SKILL.md\uFF09\uFF1B\u5220\u9664\u4E3A\u7269\u7406\u5220\u9664\uFF0C\u4E0D\u53EF\u6062\u590D\u3002\u7528\u6237\u63D0\u5230\u300C\u6280\u80FD\u7BA1\u7406 / \u6280\u80FD\u5BFC\u5165 / MCP \u670D\u52A1\u5668 / MCP \u8FDE\u63A5 / CLI \u5DE5\u5177 / CLI \u72B6\u6001\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
/**
 * Wire this plugin into a host context: adopt any legacy on-disk layout, build
 * the three engines, then register whichever surfaces the current config asks
 * for — and keep them in step with every later config change.
 *
 * @param ctx - host context exposing the webserver / tools / system-prompt services.
 * @param config - the composition entry's config, if any; schema defaults are
 *   already applied by the loader before this runs.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map