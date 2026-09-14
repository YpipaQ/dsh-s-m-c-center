/**
 * CLI manager — discovers the local command-line tools the agent can invoke
 * and reports/diagnoses their state. Two sources:
 *  - `skill`    : auto-discovered from a skill bundle that ships a
 *                 `scripts/run-cli.*` / `scripts/cli-state.*` wrapper (the
 *                 tencent-news pattern). The skill's `cli-state` script is the
 *                 authoritative probe when present.
 *  - `registry` : user-declared entries persisted in ~/.dsh/S-M-C/cli.json (mirrors
 *                 the mcp.json document), e.g. `gh`, `git`, `tencent-news-cli`.
 * Exists/path detection never spawns an untrusted binary (PATH walk only);
 * a full state probe / subcommand listing runs the resolved command on demand.
 * @module
 */
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary, NormalizedCliEntry } from './protocol.ts';
import type { SkillsManager } from './skills.ts';
/** The store's CLI registry path (kept with the rest of the S-M-C data). */
export declare function cliConfigPath(): string;
/** Read the persisted registry document (never throws). */
export declare function readCliConfig(): {
    entries: CliRegistryEntry[];
};
/** Persist the registry document (creating the directory when needed). */
export declare function writeCliConfig(data: {
    entries: CliRegistryEntry[];
}): void;
/** Validate one registry entry; returns an error string, or null when valid. */
export declare function validateCliEntry(entry: unknown): string | null;
/**
 * Normalize a registry entry to its persisted shape.
 *
 * `enabled` means "公告给 Agent" (advertised in the announcement) and is the
 * only two-state control this plugin has over a CLI — it cannot start or stop
 * one, since the system owns the executable. The flag is resolved through
 * {@link toBool} so a hand-edited cli.json carrying `"false"`, `"0"` or `0`
 * is read as 隐藏 instead of being silently promoted to 公告 — a plain
 * `!== false` check treats every non-`false` value (including the string
 * "false") as true. Anything unrecognized (missing, null, garbage) falls back
 * to the default: 隐藏. The value written back is always a real boolean, so
 * read and write agree on the shape and no invalid state can survive a save.
 */
export declare function normalizeCliEntry(entry: CliRegistryEntry): NormalizedCliEntry;
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
    /** Best-effort known install path for a tool installed outside PATH. */
    private knownInstallPath;
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
//# sourceMappingURL=cli.d.ts.map