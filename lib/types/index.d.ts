/**
 * Host half of dsh-s-m-c-center: three engines (skills on the filesystem, MCP
 * over real @deepseek-ai/dsh-mcp-client connections, the local CLI registry),
 * the /api/dsh-s-m-c-center route family the browser half drives, and the
 * system-prompt announcement.
 *
 * This module is the composition root and nothing else. It owns exactly the
 * things that cannot live inside a feature: the settings source (the store's
 * settings.json, read live on every `sync()`), the order in which the one-shot
 * migrations run, and the
 * lifecycle that ties every registered surface to the current config. The
 * actual work — what a skill is, how MCP converges, what the announcement says
 * — lives in `src/features/*`.
 *
 * The browser half contributes a first-class settings PAGE — not a card inside
 * a group; see ./client/index.ts. Nothing here patches dsh: every surface is
 * assembled from published NPM packages.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Config as ConfigShape } from './setup.ts';
export { name, inject, Config, SMC_NAMESPACE, SMC_GUIDANCE } from './setup.ts';
export type { Config as ConfigFields } from './setup.ts';
/**
 * Wire this plugin into a host context: adopt any legacy on-disk layout, build
 * the three engines, then register whichever surfaces the current config asks
 * for — and keep them in step with every later config change.
 *
 * @param ctx - host context exposing the webserver / tools / system-prompt services.
 * @param _config - the composition entry's config, if any. Kept for signature
 *   compatibility; the store's settings.json is the single source of truth.
 */
export declare function apply(ctx: Context, _config?: ConfigShape): void;
//# sourceMappingURL=index.d.ts.map