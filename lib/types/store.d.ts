/**
 * The unified external store root — the one directory this plugin owns.
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
 * - `~/.dsh/settings.yaml` — dsh's document. We own one namespace block in it,
 *   not the file.
 *
 * Every path below follows `$DSH_HOME`, and the whole root can be relocated
 * with `$DSH_STORE_ROOT` for anyone who wants the store on another drive.
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
/**
 * Move a file or directory, falling back to copy-then-delete across devices.
 *
 * `renameSync` is atomic and cheap but throws EXDEV when source and
 * destination live on different volumes — precisely what happens when the
 * store is relocated to another drive.
 */
export declare function movePath(from: string, to: string): void;
/**
 * Create the store root (and nothing below it) when it is missing.
 *
 * Callers that only *read* can skip this; it is for the migration and for
 * adoption, which both need the directory to exist before they write into it.
 * Never throws on an existing directory.
 */
export declare function ensureStoreRoot(): string;
//# sourceMappingURL=store.d.ts.map