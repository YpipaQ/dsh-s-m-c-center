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
export const SMC_API_PREFIX = '/api/dsh-s-m-c-center'

/** API paths shared by the host routes and the browser api client. */
export const SMC_API = {
  skills: '/api/dsh-s-m-c-center/skills',
  skillRead: '/api/dsh-s-m-c-center/skills/read',
  skillDelete: '/api/dsh-s-m-c-center/skills/delete',
  skillScan: '/api/dsh-s-m-c-center/skills/scan',
  /** Register external skills: the canonical copy stays where it is. */
  skillRegister: '/api/dsh-s-m-c-center/skills/register',
  /** Drop a registry entry (and its link, when one exists). */
  skillUnregister: '/api/dsh-s-m-c-center/skills/unregister',
  /** Traceability pass: check every registry entry's path still exists. */
  skillRefresh: '/api/dsh-s-m-c-center/skills/refresh',
  /** Move a native skill into the store (canonical copy + back-link). */
  skillMigrate: '/api/dsh-s-m-c-center/skills/migrate',
  /** Undo a migration: remove the link, restore the origin, drop the entry. */
  skillUnmigrate: '/api/dsh-s-m-c-center/skills/unmigrate',
  /** Create (or confirm) the `~/.dsh/skills/<slug>` link for one skill. */
  skillLink: '/api/dsh-s-m-c-center/skills/link',
  /** Remove the link for one skill (the canonical copy is never touched). */
  skillUnlink: '/api/dsh-s-m-c-center/skills/unlink',
  /** Verify one link (resolves? target alive? tracked?). */
  skillVerify: '/api/dsh-s-m-c-center/skills/verify',
  /** Delete an untracked link (one the ledger has no record of). */
  skillDeleteLink: '/api/dsh-s-m-c-center/skills/delete-link',
  /** Per-conversation selection index for one workspace. */
  contexts: '/api/dsh-s-m-c-center/contexts',
  /** One conversation's selection (get / toggle). */
  contextsGet: '/api/dsh-s-m-c-center/contexts/get',
  contextsToggle: '/api/dsh-s-m-c-center/contexts/toggle',
  contextsReset: '/api/dsh-s-m-c-center/contexts/reset',
  skillStore: '/api/dsh-s-m-c-center/skills/store',
  skillRollback: '/api/dsh-s-m-c-center/skills/rollback',
  /** Re-run the one-shot migration after a rollback (the uninstall page's undo). */
  skillRemigrate: '/api/dsh-s-m-c-center/skills/remigrate',
  mcp: '/api/dsh-s-m-c-center/mcp',
  mcpSave: '/api/dsh-s-m-c-center/mcp/save',
  /** Activate (true) or archive (false) a definition — see McpServerSummary.archived. */
  mcpEnabled: '/api/dsh-s-m-c-center/mcp/enabled',
  /** Move every archived definition back into the active document (uninstall page). */
  mcpRestoreAll: '/api/dsh-s-m-c-center/mcp/restore-all',
  mcpDelete: '/api/dsh-s-m-c-center/mcp/delete',
  mcpTest: '/api/dsh-s-m-c-center/mcp/test',
  cli: '/api/dsh-s-m-c-center/cli',
  cliState: '/api/dsh-s-m-c-center/cli/state',
  cliSubcommands: '/api/dsh-s-m-c-center/cli/subcommands',
  cliSave: '/api/dsh-s-m-c-center/cli/save',
  cliEnabled: '/api/dsh-s-m-c-center/cli/enabled',
  cliDelete: '/api/dsh-s-m-c-center/cli/delete',
  cliProbe: '/api/dsh-s-m-c-center/cli/probe',
  settings: '/api/dsh-s-m-c-center/settings',
  settingsSave: '/api/dsh-s-m-c-center/settings/save',
} as const
