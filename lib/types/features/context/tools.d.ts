/**
 * The agent-facing half of the context engine: the `skill_select` tool the
 * model calls to enable/disable skills for its own conversation, plus the
 * apply-to-agent helper the routes use when the panel flips a switch.
 *
 * The tool writes the same per-conversation JSON the panel writes, then
 * re-applies the selection through the agent's own context — the official
 * registry re-publishes the catalog, so the change is live on the next step.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillsManager } from '../skills/index.ts';
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
/** Read a runtime registration for one slug from the store / registry. */
export declare function resolveRegistration(skills: SkillsManager, slug: string): import("@deepseek-ai/dsh-skill").SkillRegistration | undefined;
/**
 * Apply one conversation's current selection to its agent: dispose the
 * previous set, register the new one through `agent.ctx`.
 */
export declare function applyToAgent(skills: SkillsManager, agent: AgentLike): void;
/**
 * The `skill_select` tool: the model's only sanctioned way to change which
 * skills its conversation sees. Writes the same JSON the panel writes, then
 * re-applies through the calling agent's own context.
 */
export declare function buildSkillSelectTool(skills: SkillsManager): import("@deepseek-ai/dsh-tools").ToolDefinition;
//# sourceMappingURL=tools.d.ts.map