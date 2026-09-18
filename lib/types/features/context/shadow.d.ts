/**
 * The shadow takeover: our own `skill` tool plus our own catalog publication.
 *
 * dsh's catalog listener only publishes when the *exact definition* it
 * registered is still what `ctx.tools.get('skill', agent)` resolves to
 * (tool-skill `:206-220`, asserted by its own spec `:754-772`). Registering a
 * same-named tool inside the agent's scope breaks that identity, so dsh stops
 * publishing its catalog — which is built from the skill roots and grows with
 * the machine, listing every linked skill whether or not this conversation
 * picked it.
 *
 * What replaces it is entirely ours:
 *
 * - The **shadow `skill` tool** loads a skill, but only one this conversation
 *   has enabled (the relay table's selection, index included). An unenabled
 *   name is a refusal with the way out, not a silent load: the switch the user
 *   flips finally decides what the model can *load*, not just what it sees.
 * - The **catalog publisher** is our own `agent/pre-step` listener that posts
 *   the same `<available_skills>` frame, but with exactly the entries this
 *   conversation publishes (the selection plus the index). Its message source
 *   uses a private kind, `smc-catalog`: dsh's catalog bookkeeping only
 *   recognizes its own `skill-catalog` kind, so the two catalogs never
 *   overwrite each other.
 *
 * `/name` is untouched: dsh's gesture listener is an independent pre-step that
 * resolves `user-invocable` skills through the skill service, not through the
 * tool, so the user's manual escape hatch survives the takeover.
 *
 * Everything here installs and unwinds with the conversation: the tool rides
 * the same injected fiber as the skill registrations (see `apply.ts`), and the
 * listener is registered through the plugin context whose teardown removes it.
 * @module
 */
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { SkillsManager } from '../skills/index.ts';
import type { AgentLike } from './tools.ts';
/** Message-source kind of our catalog frames — deliberately not dsh's. */
export declare const CATALOG_KIND = "smc-catalog";
/** One row of the model-facing catalog. */
export interface CatalogEntry {
    name: string;
    description: string;
}
/** The durable payload our catalog message records, mirroring dsh's shape. */
export interface SmcCatalogSource {
    readonly kind: 'smc-catalog';
    readonly form: 'catalog';
    /** Marks a replacement catalog rather than this session's first publication. */
    readonly update?: true;
    readonly entries: readonly CatalogEntry[];
}
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'smc-catalog': SmcCatalogSource;
    }
}
/** Catalog identity, dsh-style: hash the entries, not the prose around them. */
export declare function smcDigest(entries: readonly CatalogEntry[]): string;
/**
 * The model-facing catalog message. First publication states the frame;
 * a replacement says so explicitly, so the model drops names it saw earlier.
 */
export declare function renderSmcCatalog(entries: readonly CatalogEntry[], update: boolean): ReturnType<typeof createUserMessage>;
/**
 * What this step's message list should look like for `entries`.
 *
 * A message with the same digest already in the list is left alone (the step
 * is a no-op); a different one is replaced in place and announced as an
 * update; none means this is the first publication. Only our own kind is
 * considered — dsh's catalog messages are another plugin's property here.
 */
export declare function nextCatalogDecision<T extends {
    id: string;
    source?: {
        kind?: string;
    };
}>(messages: readonly T[], entries: readonly CatalogEntry[]): readonly T[] | undefined;
/**
 * The shadow `skill` tool.
 *
 * Same name, same call shape, same rendered output as dsh's — but the gate is
 * this conversation's selection, read from the relay table. Loading a skill
 * the conversation never enabled is a refusal that says how to get it, which
 * is what makes the panel's switch real beyond visibility.
 *
 * @param skills - the manager the registrations resolve through.
 */
export declare function buildShadowSkillTool(skills: SkillsManager): import("@deepseek-ai/dsh-tools").ToolDefinition;
/**
 * Entries this conversation's catalog should show, with the scan cached.
 *
 * The cache key is workspace + selection, so a flip recomputes exactly once
 * and every untouched turn after it is a map lookup.
 */
export declare function catalogEntriesFor(agent: AgentLike, skills: SkillsManager): CatalogEntry[];
/**
 * Register our catalog publisher on the plugin context.
 *
 * Runs after the rest of the step's waterfall (`next()` first), appends or
 * replaces our frame, and never throws into the step: a catalog hiccup must
 * not fail the turn, so everything is wrapped.
 */
export declare function attachSmcCatalog(ctx: {
    on(event: string, listener: unknown): unknown;
}, skills: SkillsManager): void;
//# sourceMappingURL=shadow.d.ts.map