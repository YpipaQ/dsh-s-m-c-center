/**
 * Browser-side client for the `/api/dsh-s-m-c-center` route family.
 *
 * The only data path the tabs use: plain `fetch`, same origin, JSON in and
 * out. Every call funnels through {@link call} so the two failure modes a
 * route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
 * — surface the same way, and a failure never arrives as a silent `undefined`.
 */
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary, ImportItem, ManagerSettings, McpServerConfig, McpServerSummary, ScannedSkill, SkillDetail, SkillGroup, SkillSummary, StoreOperation, StoreStatus, VerifyResult } from '../protocol.ts';
/** Raised for any route call that did not come back as `ok`. */
export declare class SkillsMcpApiError extends Error {
    constructor(message: string);
}
/** The browser half's only data entry point. */
export declare class SkillsMcpApi {
    listSkills(cwd: string): Promise<SkillSummary[]>;
    readSkill(path: string): Promise<SkillDetail>;
    /** Native → stored: canonical copy into the store, link back in place. */
    migrateSkill(path: string, kind: 'bundle' | 'file', source: SkillSummary['source']): Promise<string>;
    /** Undo a migration: link + ledger + manifest go, the copy returns home. */
    unmigrateSkill(slug: string): Promise<void>;
    /** Create (or confirm) the `~/.dsh/skills/<slug>` link. */
    linkSkill(slug: string): Promise<void>;
    /** Remove the link (the canonical copy is never touched). */
    unlinkSkill(slug: string): Promise<void>;
    /** The per-skill announcement flag (公告 / 隐藏). */
    setSkillAnnounce(group: SkillGroup, slug: string, announce: boolean): Promise<void>;
    /** Verify one link (resolves? target alive? tracked?). */
    verifyLink(slug: string): Promise<VerifyResult>;
    /** Delete an untracked link (one the ledger has no record of). */
    deleteUntrackedLink(path: string): Promise<void>;
    deleteSkill(path: string, kind: 'bundle' | 'file'): Promise<void>;
    scanSkills(dir: string): Promise<ScannedSkill[]>;
    /** Register external skills — the canonical copy stays where it is. */
    registerSkills(items: ImportItem[]): Promise<Array<{
        name: string;
        ok: boolean;
        reason?: string;
    }>>;
    /** Drop a registry entry (and its link, when one exists). */
    unregisterSkill(slug: string): Promise<void>;
    /** Traceability pass: does every registered path still exist? */
    refreshRegistry(): Promise<Array<{
        slug: string;
        name: string;
        exists: boolean;
    }>>;
    /** Conversations that hold a selection under one workspace (default first). */
    listContexts(cwd: string): Promise<{
        workspace: string;
        defaultId: string;
        selections: Array<{
            sessionId: string;
            count: number;
            updatedAt: string;
        }>;
    }>;
    /** One conversation's selection. */
    getContext(sessionId: string, cwd: string): Promise<{
        workspace: string;
        selection: {
            sessionId: string;
            selected: string[];
            updatedAt: string;
        };
    }>;
    /** Flip one slug in one conversation; applied live when it is running. */
    toggleContext(sessionId: string, slug: string, cwd: string): Promise<{
        selection: {
            sessionId: string;
            selected: string[];
        };
        applied: boolean;
    }>;
    storeStatus(): Promise<StoreStatus>;
    /** Undo the one-shot migration: every stored skill returns to its origin. */
    rollbackStore(): Promise<StoreOperation>;
    /** Run the one-shot migration again — the undo for {@link rollbackStore}. */
    reMigrateStore(): Promise<StoreOperation>;
    listMcp(): Promise<McpServerSummary[]>;
    saveMcp(server: McpServerConfig): Promise<void>;
    /** Activate (true) or archive (false) one definition. */
    setMcpEnabled(name: string, enabled: boolean): Promise<void>;
    deleteMcp(name: string): Promise<void>;
    /** Restore the whole archive at once; returns how many came back. */
    restoreAllMcp(): Promise<number>;
    testMcp(server: McpServerConfig): Promise<{
        ok: boolean;
        error?: string;
    }>;
    listCli(cwd: string): Promise<CliSummary[]>;
    cliState(name: string, cwd: string): Promise<CliStateDetail>;
    cliSubcommands(name: string, cwd: string): Promise<CliSubcommands>;
    saveCli(entry: CliRegistryEntry): Promise<void>;
    setCliEnabled(name: string, enabled: boolean): Promise<void>;
    deleteCli(name: string): Promise<void>;
    /** Both probe halves in one round trip (state + subcommands). */
    probeCli(name: string, cwd: string): Promise<{
        state: CliStateDetail;
        subcommands: CliSubcommands;
    }>;
    getSettings(): Promise<ManagerSettings>;
    saveSettings(settings: Partial<ManagerSettings>): Promise<ManagerSettings>;
}
//# sourceMappingURL=api.d.ts.map