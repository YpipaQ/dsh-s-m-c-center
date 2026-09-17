/**
 * The agent-facing half of the context engine: the `skill_select` tool the
 * model calls to enable/disable skills for its own conversation, plus the
 * apply-to-agent helper the routes and the lifecycle hook share.
 *
 * Installing the registrations is `./apply.ts`'s job — it owns the cordis
 * fiber lifetimes. What lives here is *deciding* what should be installed and
 * *reporting* what actually happened, honestly:
 *
 * - the requested state decides set/unset; nothing is flipped blind, so asking
 *   for `selected: true` on an already-selected skill is a no-op, not a
 *   surprise removal;
 * - the selection file is written **only after** an apply succeeded, so a
 *   failure can never leave the file (and the panel) claiming a skill is on;
 * - a failed apply is answered with `applied: false` + `error`, never thrown —
 *   the model needs to learn what state it left behind, and a bare throw tells
 *   it nothing.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillsManager } from '../skills/index.ts';
import type { ApplyOutcome, SkillBindings } from './apply.ts';
import type { ContextSelection } from './engine.ts';
/** The slice of a real dsh Agent this engine touches. */
export interface AgentLike {
    /** Session id (stable across turns). */
    readonly id: string;
    /** The agent's own (scoped) context — registrations land in its layer. */
    readonly ctx: Context;
    /** Workspace the conversation runs in. */
    readonly session?: {
        header?: {
            cwd?: string;
        };
    };
}
/** The workspace a conversation runs in, as dsh reports it. */
export declare function workspaceOfAgent(agent: AgentLike): string;
/** The slugs in `selection` whose canonical copy cannot be resolved. */
export declare function missingSlugs(skills: SkillsManager, selection: ContextSelection): string[];
/**
 * Bring one conversation's agent in line with a selection.
 *
 * The lifecycle hook (a new or resumed conversation), the panel and the tool
 * all call this; it is idempotent, so calling it again with the same selection
 * costs nothing and never disturbs a working binding.
 *
 * `selection` exists because the caller has usually *just computed* the new
 * selection and the file still holds the old one. Re-reading the file here made
 * the panel apply one flip behind — it installed the previous set, answered
 * `applied: true` (the names had not changed, so the idempotent short-circuit
 * fired) and only then wrote the new file. The lifecycle hook passes nothing
 * and keeps reading the file, which is what "apply what this conversation
 * asked for" means at creation time.
 *
 * Never throws: the callers are on the session-creation path, where an
 * exception would veto the conversation itself.
 */
export declare function applyToAgent(skills: SkillsManager, bindings: SkillBindings, agent: AgentLike, selection?: ContextSelection): Promise<ApplyOutcome>;
/**
 * Drop the slugs nothing could resolve, so a phantom name never reaches the
 * selection file and the copy never reports a skill that is not there.
 */
export declare function withoutMissing(selection: ContextSelection, missing: string[]): ContextSelection;
/**
 * The `skill_select` tool: the model's only sanctioned way to change which
 * skills its conversation sees. Plans the change, applies it through the
 * calling agent's own context, and persists only once that worked.
 */
export declare function buildSkillSelectTool(skills: SkillsManager, bindings: SkillBindings): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=tools.d.ts.map