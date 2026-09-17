/**
 * Wire contract shared by the two halves of the plugin: every type that crosses
 * /api/dsh-s-m-c-center, plus the path constants for that route family — the one
 * place a route rename has to be applied. Types only otherwise; the browser
 * half imports no Host value from here.
 * @module
 */
/** Which of the four roots a skill was found under. */
export type SkillSource = 'project-dsh' | 'project-agents' | 'user-dsh' | 'user-agents';
/** How the UI groups skills: by the workspace they belong to, or the user. */
export type SkillLevel = 'project' | 'user';
/**
 * Which of the four groups a row belongs to:
 * 1. `native` — a real file/directory in a scanned skill root;
 * 2. `stored` — the canonical copy lives in the store (`S-M-C/skills`);
 * 3. `registered` — an external skill whose copy stays where it was, recorded
 *    in `skills-registry.json`.
 * (Group 4 — the links themselves — is a property of the rows above: `linked`.)
 */
export type SkillGroup = 'native' | 'stored' | 'registered';
/** One row of the skills list. */
export interface SkillSummary {
    /** Skill name, from SKILL.md frontmatter. */
    name: string;
    /** One-line summary from frontmatter (dsh requires it). */
    description: string;
    /** Optional "when to use this" note ('' when frontmatter has none). */
    whenToUse: string;
    /** Which of the four groups this row belongs to. */
    group: SkillGroup;
    /** Whether the skill appears in the agent announcement. */
    announce: boolean;
    /** Whether a link to the canonical copy exists under `~/.dsh/skills`. */
    linked: boolean;
    /** True for a link on disk that the link ledger has no record of (red flag). */
    untracked?: boolean;
    /** The root it lives under, which also decides its level. */
    source: SkillSource;
    level: SkillLevel;
    /** A directory holding SKILL.md or DESCRIPTION.md, or a single flat `.md` file. */
    kind: 'bundle' | 'file';
    /** Absolute path of the admission document (SKILL.md / DESCRIPTION.md) or of the `.md` file. */
    path: string;
    /** Store / registry slug; present for stored and registered rows. */
    slug?: string;
}
/** One skill including its body, for the detail pane. */
export interface SkillDetail {
    name: string;
    description: string;
    whenToUse: string;
    /** Markdown body with the frontmatter block stripped. */
    content: string;
    path: string;
}
/** A skill candidate found by scanning a directory the user picked. */
export interface ScannedSkill {
    name: string;
    description: string;
    /** Where to register from: the bundle directory, or the `.md` file. */
    sourcePath: string;
    kind: 'bundle' | 'file';
    /** True when the candidate exceeds the 10 GB import cap. */
    oversize: boolean;
    /** On-disk size in bytes (best effort). */
    size: number;
}
/** One checked row of a scan, sent back to be registered. */
export interface ImportItem {
    sourcePath: string;
    kind: 'bundle' | 'file';
}
/**
 * One skill held in the store: the canonical copy lives under
 * `~/.dsh/S-M-C/skills/<slug>/`. `origin` records where it came from so a
 * migration can be undone. Link state lives in the link ledger, visibility
 * in the announcement flag — never in the SKILL.md itself.
 */
export interface StoreEntry {
    /** Store directory name (unique within the store). */
    slug: string;
    /** Skill name from SKILL.md at adopt time. */
    name: string;
    /**
     * Where an unmigrate releases the skill: its pre-adoption path. Empty for
     * skills dropped straight into the store by an agent (no origin to restore).
     */
    origin: string;
    /** Whether the skill appears in the agent announcement. */
    announce: boolean;
    adoptedAt: string;
}
/** Persisted store manifest (`~/.dsh/S-M-C/skills/index.json`). */
export interface StoreIndex {
    version: 1;
    /** ISO timestamp of the one-shot migration, when it has run. */
    migratedAt?: string;
    entries: StoreEntry[];
    /** Skills the last migration could not move (left in place, still usable). */
    failures?: StoreFailure[];
}
/** One skill the migration could not move. */
export interface StoreFailure {
    path: string;
    reason: string;
}
/** Outcome of a migration or rollback run. */
export interface StoreOperation {
    /** Number of skills moved (or restored, for a rollback). */
    moved: number;
    failures: StoreFailure[];
}
/** Store state shown in the UI banner. */
export interface StoreStatus {
    /** The unified store root (e.g. `~/.dsh/S-M-C`), shown verbatim in the UI. */
    root: string;
    /** The skills directory inside it. */
    dir: string;
    migrated: boolean;
    migratedAt?: string;
    /** Skills currently held in the store. */
    count: number;
    /** Stored skills currently linked into `~/.dsh/skills`. */
    linked: number;
    /** Ledger records whose link no longer exists on disk. */
    untracked: number;
    failures: StoreFailure[];
}
/** One registered external/native skill (a row of `skills-registry.json`). */
export interface RegistryEntry {
    /** Registry slug (unique across registry + store). */
    slug: string;
    name: string;
    description: string;
    /** Canonical path: the bundle directory or the flat `.md` file. */
    path: string;
    kind: 'bundle' | 'file';
    /** `native` for skills found in a scanned root, `external` for imports. */
    origin: 'native' | 'external';
    /** Whether the skill appears in the agent announcement. */
    announce: boolean;
    registeredAt: string;
    /** Last successful existence check (the refresh button's traceability). */
    lastSeen?: string;
}
/** Persisted external-skills registry (`~/.dsh/S-M-C/skills-registry.json`). */
export interface SkillsRegistry {
    version: 1;
    entries: RegistryEntry[];
}
/** One ledger record for a link this plugin created. */
export interface LinkRecord {
    /** Skill slug the link serves. */
    slug: string;
    /** Absolute path of the link (always under `~/.dsh/skills`). */
    linkPath: string;
    /** Absolute path of the canonical copy the link points at. */
    targetPath: string;
    createdAt: string;
}
/** Persisted link ledger (`~/.dsh/S-M-C/skills-links.json`). */
export interface SkillLinks {
    version: 1;
    links: LinkRecord[];
}
/** Outcome of verifying one link. */
export interface VerifyResult {
    ok: boolean;
    reason?: string;
    /** Whether the link has a ledger record. */
    tracked?: boolean;
    /** Whether the target is a store copy. */
    stored?: boolean;
    target?: string;
    mdPath?: string;
}
/** MCP transport kinds the manager supports. */
export type McpTransport = 'stdio' | 'streamable-http';
/** One persisted MCP server definition (a row of `mcp.json`). */
export interface McpServerConfig {
    /** Server name; also the namespace its tools register under. */
    name: string;
    transport: McpTransport;
    /** Absent counts as active — only an explicit `false` means archived. */
    enabled?: boolean;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    url?: string;
    headers?: Record<string, string>;
}
/** Connection state the manager reports for one server. */
export type McpConnectionStatus = 'connecting' | 'running' | 'failed' | 'stopped';
/**
 * One MCP server as returned to the UI (full config + live connection state).
 *
 * `enabled` is narrowed to a concrete boolean here: the host's `summarize()`
 * resolves the optional persisted flag (`enabled !== false`) before sending, so
 * the browser never has to treat "absent" and "true" as different states.
 */
export interface McpServerSummary extends Omit<McpServerConfig, 'enabled'> {
    enabled: boolean;
    status: McpConnectionStatus;
    error?: string;
    /**
     * True when the definition lives in `~/.dsh/S-M-C/mcp-archive.json` instead of the
     * active document. Archived servers are never connected and never announced;
     * `enabled` is false for them too, so a single switch still reads correctly.
     */
    archived: boolean;
}
/** Persisted archive document (`~/.dsh/S-M-C/mcp-archive.json`). */
export interface McpArchive {
    version: 1;
    servers: McpServerConfig[];
}
/** One CLI tool's source: auto-discovered from a skill's wrapper scripts, or a user registry entry. */
export type CliSource = 'skill' | 'registry';
/** One local CLI tool as listed in the UI (auto-discovered or registered). */
export interface CliSummary {
    /** CLI command name (e.g. `tencent-news-cli`). */
    name: string;
    /** Invocation name the agent would run. */
    command: string;
    source: CliSource;
    /** Owning skill name when `source === 'skill'`. */
    skill?: string;
    /** Path to the skill's `run-cli` wrapper script, when present. */
    runScript?: string;
    /** Path to the skill's `cli-state` probe script, when present. */
    stateScript?: string;
    /** Whether the registry/system entry is enabled. */
    enabled: boolean;
    /** Whether the executable resolves on PATH (or a known global install dir). */
    exists: boolean;
    /** Resolved executable path, when found. */
    path?: string;
}
/** Detailed probe state for one CLI, fetched lazily. */
export interface CliStateDetail {
    name: string;
    exists: boolean;
    path?: string;
    version?: string;
    needUpdate?: boolean;
    apiKey?: {
        status?: string;
        present?: boolean;
        error?: string;
    };
    platform?: {
        os?: string;
        arch?: string;
        cliPath?: string;
        cliSource?: string;
    };
    error?: string;
}
/** Parsed `help` output for one CLI: its subcommand list plus raw help text. */
export interface CliSubcommands {
    name: string;
    command: string;
    subcommands: string[];
    help: string;
}
/** One persisted registry entry (a user-declared CLI the plugin watches). */
export interface CliRegistryEntry {
    /** CLI command name (unique). */
    name: string;
    /** Invocation name (defaults to `name`). */
    command: string;
    /**
     * Whether the CLI is announced to the agent: 公告 (true) or 隐藏 (false).
     *
     * This plugin cannot start or stop a CLI — the system owns the executable —
     * so the flag only decides whether the CLI appears in the announcement.
     * Optional in the persisted document because cli.json is hand-editable and
     * may omit it; the default is 隐藏. After normalization (see
     * {@link NormalizedCliEntry}) the flag is always a resolved boolean.
     */
    enabled?: boolean;
}
/** A registry entry whose provided flag has been resolved (never undefined). */
export type NormalizedCliEntry = CliRegistryEntry & {
    enabled: boolean;
};
/** The plugin's own config (mirrors the host-side `Config` schema). */
export interface ManagerSettings {
    /** Master switch: routes, MCP connections, prompt section. */
    enabled: boolean;
    /** Announce the plugin to every agent's system prompt. */
    announceToAgent: boolean;
}
/** API paths shared by the host routes and the browser api client. */
export declare const SMC_API: {
    readonly skills: "/api/dsh-s-m-c-center/skills";
    readonly skillRead: "/api/dsh-s-m-c-center/skills/read";
    readonly skillDelete: "/api/dsh-s-m-c-center/skills/delete";
    readonly skillScan: "/api/dsh-s-m-c-center/skills/scan";
    /** Register external skills: the canonical copy stays where it is. */
    readonly skillRegister: "/api/dsh-s-m-c-center/skills/register";
    /** Drop a registry entry (and its link, when one exists). */
    readonly skillUnregister: "/api/dsh-s-m-c-center/skills/unregister";
    /** Traceability pass: check every registry entry's path still exists. */
    readonly skillRefresh: "/api/dsh-s-m-c-center/skills/refresh";
    /** Move a native skill into the store (canonical copy + back-link). */
    readonly skillMigrate: "/api/dsh-s-m-c-center/skills/migrate";
    /** Undo a migration: remove the link, restore the origin, drop the entry. */
    readonly skillUnmigrate: "/api/dsh-s-m-c-center/skills/unmigrate";
    /** Create (or confirm) the `~/.dsh/skills/<slug>` link for one skill. */
    readonly skillLink: "/api/dsh-s-m-c-center/skills/link";
    /** Remove the link for one skill (the canonical copy is never touched). */
    readonly skillUnlink: "/api/dsh-s-m-c-center/skills/unlink";
    /** The per-skill announcement flag (公告 / 隐藏). */
    readonly skillAnnounce: "/api/dsh-s-m-c-center/skills/announce";
    /** Verify one link (resolves? target alive? tracked?). */
    readonly skillVerify: "/api/dsh-s-m-c-center/skills/verify";
    /** Delete an untracked link (one the ledger has no record of). */
    readonly skillDeleteLink: "/api/dsh-s-m-c-center/skills/delete-link";
    /** Per-conversation selection index for one workspace. */
    readonly contexts: "/api/dsh-s-m-c-center/contexts";
    /** One conversation's selection (get / toggle). */
    readonly contextsGet: "/api/dsh-s-m-c-center/contexts/get";
    readonly contextsToggle: "/api/dsh-s-m-c-center/contexts/toggle";
    readonly skillStore: "/api/dsh-s-m-c-center/skills/store";
    readonly skillRollback: "/api/dsh-s-m-c-center/skills/rollback";
    /** Re-run the one-shot migration after a rollback (the uninstall page's undo). */
    readonly skillRemigrate: "/api/dsh-s-m-c-center/skills/remigrate";
    readonly mcp: "/api/dsh-s-m-c-center/mcp";
    readonly mcpSave: "/api/dsh-s-m-c-center/mcp/save";
    /** Activate (true) or archive (false) a definition — see McpServerSummary.archived. */
    readonly mcpEnabled: "/api/dsh-s-m-c-center/mcp/enabled";
    /** Move every archived definition back into the active document (uninstall page). */
    readonly mcpRestoreAll: "/api/dsh-s-m-c-center/mcp/restore-all";
    readonly mcpDelete: "/api/dsh-s-m-c-center/mcp/delete";
    readonly mcpTest: "/api/dsh-s-m-c-center/mcp/test";
    readonly cli: "/api/dsh-s-m-c-center/cli";
    readonly cliState: "/api/dsh-s-m-c-center/cli/state";
    readonly cliSubcommands: "/api/dsh-s-m-c-center/cli/subcommands";
    readonly cliSave: "/api/dsh-s-m-c-center/cli/save";
    readonly cliEnabled: "/api/dsh-s-m-c-center/cli/enabled";
    readonly cliDelete: "/api/dsh-s-m-c-center/cli/delete";
    readonly cliProbe: "/api/dsh-s-m-c-center/cli/probe";
    readonly settings: "/api/dsh-s-m-c-center/settings";
    readonly settingsSave: "/api/dsh-s-m-c-center/settings/save";
};
//# sourceMappingURL=protocol.d.ts.map