/**
 * Model-facing announcement.
 *
 * The announcement tells the agent that this plugin exists and — importantly —
 * what is actually on the machine right now. A static blurb cannot do that, so
 * the section text is a provider: it is re-evaluated at every prompt assembly
 * and the live skills / MCP servers / CLI tools are spliced in.
 *
 * Motivation (see the CLI case in particular): skills are announced natively by
 * dsh (`<available_skills>` + the `skill` tool) and MCP tools land in the
 * tool list as `mcp__<server>__<tool>`, so neither needs this section. Local
 * CLI tools are registered nowhere — without listing them here the agent has
 * no way to learn that `gh`, `git` or a skill-wrapped CLI exists at all.
 *
 * Every section of the renderer is defensive: a prompt assembly must never fail
 * (or hang) because a directory walk threw, so each block degrades to a short
 * placeholder on error.
 * @module
 */
import type { CliManager } from '../cli/index.ts';
import type { McpManager } from '../mcp/index.ts';
import type { SkillsManager } from '../skills/index.ts';
export interface AnnounceSources {
    skills: SkillsManager;
    mcp: McpManager;
    cli: CliManager;
}
/** Drop the cached announcement so the next assembly rebuilds it. */
export declare function invalidateAnnouncement(): void;
/**
 * Build the announcement text for one prompt assembly (memoized).
 *
 * @param sources - the live managers to read from.
 * @param cwd - workspace root for project-scoped discovery, when known.
 */
export declare function renderAnnouncement(sources: AnnounceSources, cwd?: string): string;
//# sourceMappingURL=announce.d.ts.map