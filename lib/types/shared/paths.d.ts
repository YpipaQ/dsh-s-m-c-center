/**
 * The unified external store root — the one directory this plugin owns, plus
 * the root dsh keeps its own files in.
 *
 * Skills, MCP and CLI data used to scatter four separate artefacts across
 * `$DSH_HOME` (`skills-store/`, `mcp.json`, `mcp-archive.json`, `cli.json`),
 * so "what does this plugin actually keep?" was a question you could only
 * answer by reading the source. They now sit together under one directory
 * whose name spells out its contents: **S**kills / **M**CP / **C**LI.
 *
 * Two things deliberately stay outside it:
 *
 * - `~/.dsh/skills/` — dsh's own skill root. The agent scans it, so it has to
 *   stay where dsh looks; what we do is point *links* in it at the store.
 *
 * (`~/.dsh/settings.yaml` used to hold the plugin's config block too, but dsh
 * 0.1.7 archives that file on upgrade, so the block moved into the store —
 * `settings.json` above.)
 *
 * Every path below follows `$DSH_HOME`, and the whole root can be relocated
 * with `$DSH_STORE_ROOT` for anyone who wants the store on another drive.
 *
 * This module is pure path arithmetic plus `ensureStoreRoot`; the filesystem
 * verbs (move/copy/tree-walk) live in `./fs-utils.ts` so that callers that only
 * need a path never pull in the fs surface.
 * @module
 */
/** Directory name of the unified store inside `$DSH_HOME`. */
export declare const STORE_ROOT_NAME = "S-M-C";
/** Sub-directory holding the canonical copy of every adopted skill. */
export declare const STORE_SKILLS_NAME = "skills";
/** File name of the active MCP document. */
export declare const STORE_MCP_NAME = "mcp.json";
/** File name of the archived MCP document. */
export declare const STORE_MCP_ARCHIVE_NAME = "mcp-archive.json";
/** File name of the CLI registry. */
export declare const STORE_CLI_NAME = "cli.json";
/** File name of the external-skills registry (canonical copies stay in place). */
export declare const STORE_SKILLS_REGISTRY_NAME = "skills-registry.json";
/** File name of the link ledger (every junction this plugin ever created). */
export declare const STORE_SKILLS_LINKS_NAME = "skills-links.json";
/**
 * File name of the session-skill table — the relay document.
 *
 * This one is deliberately **one file for the whole machine**, not one per
 * workspace. Which skills a conversation has enabled used to live in
 * `<workspace>/.dsh/S-M-C/contexts/<sessionId>.json`, which meant the answer
 * depended on resolving the right workspace first: two panels asking the same
 * question could read two different files (the settings page resolves the
 * workspace dsh reports for the *page*, the sidebar resolves the one the
 * *conversation* runs in), and a workspace whose root cannot be determined at
 * all filed its state somewhere nobody would look. The state is
 * per-conversation — its natural key is the session id, which is unique on its
 * own — so it is kept in one table and nothing has to guess a directory.
 */
export declare const STORE_CONTEXT_TABLE_NAME = "contexts.json";
/**
 * File name of the plugin's own settings document.
 *
 * Lives in the store on purpose: dsh 0.1.7 archives `~/.dsh/settings.yaml` to
 * `settings.yaml.imported` on upgrade, wiping every third-party block in it —
 * and with it every setting this plugin used to keep there. The store is the
 * one directory the plugin owns end to end, so its config belongs there too.
 */
export declare const STORE_SETTINGS_NAME = "settings.json";
/** The dsh home directory: `$DSH_HOME`, falling back to `~/.dsh`. */
export declare function dshHomeDir(): string;
/**
 * Root of the unified store.
 *
 * `$DSH_STORE_ROOT` wins when set, so the store can live outside `$DSH_HOME`
 * (another drive, a synced folder, …) without disturbing dsh itself. Relative
 * values are resolved against the process cwd, like any other path.
 */
export declare function storeRoot(): string;
/** `$STORE_ROOT/skills` — canonical copies of adopted skills. */
export declare function storeSkillsDir(): string;
/** `$STORE_ROOT/mcp.json` — active MCP server definitions. */
export declare function storeMcpPath(): string;
/** `$STORE_ROOT/mcp-archive.json` — archived MCP definitions. */
export declare function storeMcpArchivePath(): string;
/** `$STORE_ROOT/cli.json` — the local CLI registry. */
export declare function storeCliPath(): string;
/** `$STORE_ROOT/skills-registry.json` — external skills registered in place. */
export declare function storeSkillsRegistryPath(): string;
/** `$STORE_ROOT/skills-links.json` — the ledger of links this plugin created. */
export declare function storeSkillsLinksPath(): string;
/** `$STORE_ROOT/contexts.json` — the session-skill relay table. */
export declare function storeContextTablePath(): string;
/** `$STORE_ROOT/settings.json` — the plugin's own settings document. */
export declare function storeSettingsPath(): string;
/**
 * Create the store root (and nothing below it) when it is missing.
 *
 * Callers that only *read* can skip this; it is for the migration and for
 * adoption, which both need the directory to exist before they write into it.
 * Never throws on an existing directory.
 */
export declare function ensureStoreRoot(): string;
//# sourceMappingURL=paths.d.ts.map