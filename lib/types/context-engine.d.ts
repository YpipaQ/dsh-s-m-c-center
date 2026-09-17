/**
 * The conversation context engine — phase two's selection layer.
 *
 * One job: keep `~/.dsh/<workspace>/.dsh/S-M-C/contexts/<sessionId>.json` in
 * step with the skills each conversation has chosen, and mirror that choice
 * into the official skill registry as agent-scoped runtime registrations
 * (`agent.ctx.skills.register()` / its disposer). Everything downstream —
 * catalog messages, the `skill` tool, `/name` gestures — stays official; the
 * engine only decides *which* skills a given conversation can see.
 *
 * Guarantees:
 * - A conversation with no selection file inherits the workspace default
 *   (`contexts/_default.json`, edited through the panel's 默认配置 row); with
 *   no default file either it sees no managed skill through this engine
 *   (official roots keep working as dsh ships them).
 * - SKILL.md files are never touched; the choice lives in the JSON per
 *   conversation, so two conversations can hold different selections at once.
 * - The agent toggles through the registered `skill_select` tool, which writes
 *   the same JSON the panel writes — UI and agent always agree.
 * @module
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
/** Directory (inside the workspace) that holds per-conversation selections. */
export declare const CONTEXTS_DIR_NAME = "contexts";
/**
 * Session id the workspace default selection lives under. A conversation
 * without a selection file of its own inherits this selection, so the panel's
 * default row is "the skills new conversations start with". Real dsh session
 * ids never look like this.
 */
export declare const DEFAULT_CONTEXT_ID = "_default";
/** Per-conversation selection document. */
export interface ContextSelection {
    sessionId: string;
    /** Selected skill slugs (store / registry identity), in pick order. */
    selected: string[];
    updatedAt: string;
}
export interface ContextEngineDeps {
    /**
     * Resolve the skills a slug names, so the engine can register the chosen
     * skills with the official registry: full body included.
     * @returns the registration input, or undefined when the skill is gone.
     */
    resolve: (slug: string) => SkillRegistration | undefined;
}
/**
 * Read one conversation's selection: its own file when it has one, otherwise
 * the workspace default, otherwise the empty selection. The fallback is what
 * makes the panel's 默认配置 row real — a fresh conversation starts with the
 * default picks already registered. Tolerates a missing or corrupt file — a
 * broken selection must never take down the plugin or the conversation.
 */
export declare function readSelection(workspaceRoot: string, sessionId: string): ContextSelection;
/** Write one conversation's selection atomically (tmp + rename). */
export declare function writeSelection(workspaceRoot: string, selection: ContextSelection): void;
/** Path of one conversation's selection document. */
export declare function selectionPath(workspaceRoot: string, sessionId: string): string;
/**
 * Apply one conversation's selection to its agent: register the chosen skills
 * into the agent's private layer, dispose everything this engine registered
 * before. Returns the composite disposer for the new set.
 */
export declare function applySelection(agentCtx: Context, workspaceRoot: string, sessionId: string, deps: ContextEngineDeps): () => void;
/**
 * List every conversation selection under one workspace (panel index).
 * The workspace default (`_default`) is always present as the first row —
 * the dropdown's "skills new conversations start with" entry — followed by
 * the conversations that hold a file, newest change first.
 */
export declare function listSelections(workspaceRoot: string): Array<{
    sessionId: string;
    count: number;
    updatedAt: string;
}>;
/** Workspace root for a cwd: the nearest .git ancestor (dsh's own rule). */
export declare function workspaceOf(cwd?: string): string;
/** Read-only snapshot combining the selection with resolvable rows (panel). */
export declare function selectionDetail(workspaceRoot: string, sessionId: string): ContextSelection;
/** Flip one slug in one conversation's selection and persist it. */
export declare function toggleSelection(workspaceRoot: string, sessionId: string, slug: string): ContextSelection;
/** Default workspace fallback used by routes without an explicit cwd. */
export declare function defaultWorkspace(): string;
//# sourceMappingURL=context-engine.d.ts.map