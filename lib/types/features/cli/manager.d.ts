/**
 * The CLI manager: two sources merged into one list.
 *
 * - `skill` — auto-discovered. A skill bundle that ships `scripts/run-cli.*` or
 *   `scripts/cli-state.*` is advertising a CLI it wraps, and its `cli-state`
 *   script is the authoritative probe when one exists.
 * - `registry` — user-declared rows in `cli.json`, seeded with `gh` / `git` /
 *   `tencent-news-cli`.
 *
 * A skill-provided CLI has no registry row of its own, so its 公告 flag comes
 * from a same-named row when one exists and reads as hidden otherwise. That is
 * why {@link setEnabled} upserts rather than editing in place.
 * @module
 */
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary } from '../../shared/protocol/index.ts';
import type { SkillsManager } from '../skills/index.ts';
export { cliConfigPath, normalizeCliEntry, readCliConfig, validateCliEntry, writeCliConfig } from './registry.ts';
/**
 * Owns skill-derived CLI discovery plus the persisted registry. Runs in the
 * Host process; only PATH walks happen during `list`, heavier probes on demand.
 */
export declare class CliManager {
    private readonly skills;
    constructor(skills: SkillsManager);
    /** One element of the merged CLI list, still independent of registry state. */
    private skillEntries;
    /** Registry entries mapped to summary form (path detection only). */
    private registryEntries;
    /** Merge skill-derived and registry CLI entries into the UI list. */
    list(cwd?: string): CliSummary[];
    /** Probe one CLI's detailed state (cli-state script, else version). */
    readState(name: string, cwd?: string): Promise<CliStateDetail>;
    /** Generic version probe for a non-skill CLI. */
    private genericState;
    /** Parse a CLI's `help` output into its subcommand list. */
    listSubcommands(name: string, cwd?: string): Promise<CliSubcommands>;
    /** Registry mutation: upsert one entry. */
    saveEntry(entry: CliRegistryEntry): CliRegistryEntry;
    /**
     * Registry mutation: set whether a CLI is advertised to the agent.
     *
     * Upserts, so it also works for a skill-provided CLI, which has no registry
     * entry of its own: flipping such a row writes one, and that entry is what
     * {@link skillEntries} reads back. The document is seeded from the built-ins
     * first, so toggling a built-in always lands instead of silently no-oping.
     */
    setEnabled(name: string, enabled: boolean): void;
    /**
     * Registry mutation: remove one entry.
     * Seeded from the built-ins first, so deleting one of them actually sticks —
     * writing an empty document would just reinstate the fallback list on read.
     */
    removeEntry(name: string): void;
}
//# sourceMappingURL=manager.d.ts.map