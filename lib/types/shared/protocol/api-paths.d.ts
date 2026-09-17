/**
 * The /api/dsh-s-m-c-center route-family contract.
 *
 * Every path the host registers and the browser client calls, in one table.
 * It lives alone because it is the single place a route rename has to be
 * applied — the feature modules import their own entries rather than spelling
 * the URL out.
 *
 * The family has one prefix (`/api/`) and two halves: the plugin namespace,
 * then the feature (`skills` / `contexts` / `mcp` / `cli` / `settings`). The
 * feature segment is what the route tables in `src/features/<name>/routes.ts`
 * group by.
 * @module
 */
/** Prefix every route in this family shares. */
export declare const SMC_API_PREFIX = "/api/dsh-s-m-c-center";
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
//# sourceMappingURL=api-paths.d.ts.map