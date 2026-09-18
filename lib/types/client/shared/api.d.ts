/**
 * Browser-side client for the `/api/dsh-s-m-c-center` route family.
 *
 * The only data path the tabs use: plain `fetch`, same origin, JSON in and
 * out. Every call funnels through {@link call} so the two failure modes a
 * route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
 * — surface the same way, and a failure never arrives as a silent `undefined`.
 */
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary, ImportItem, ManagerSettings, McpServerConfig, McpServerSummary, ScannedSkill, SkillDetail, SkillSummary, StoreOperation, StoreStatus, VerifyResult } from '../../shared/protocol/index.ts';
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
    /** Create (or confirm) the `~/.dsh/skills/<slug>` link. */
    linkSkill(slug: string): Promise<void>;
    /** Remove the link (the canonical copy is never touched). */
    unlinkSkill(slug: string): Promise<void>;
    /** Verify one link (resolves? target alive? tracked?). */
    verifyLink(slug: string): Promise<VerifyResult>;
    /** Delete an untracked link (one the ledger has no record of). */
    deleteUntrackedLink(path: string): Promise<void>;
    /**
     * Delete one **stored** skill by slug. Only the store's canonical copies are
     * addressable this way — a native or registered skill is the user's (or
     * another tool's) file and is never removed by this plugin.
     */
    deleteSkill(slug: string): Promise<void>;
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
    /** One conversation's selection: the effective set plus how it differs. */
    getContext(sessionId: string): Promise<{
        /** Path of the relay table — shown in the UI so the state is findable. */
        table: string;
        selection: {
            sessionId: string;
            selected: string[];
            updatedAt: string;
            /** False when the conversation has no row of its own (pure default). */
            configured?: boolean;
            /** The diff against the default, for a conversation that has one. */
            overrides?: {
                on: string[];
                off: string[];
            };
        };
    }>;
    /** Flip one slug in one conversation; applied live when it is running. */
    toggleContext(sessionId: string, slug: string): Promise<{
        table: string;
        selection: {
            sessionId: string;
            selected: string[];
        };
        applied: boolean;
    }>;
    /**
     * Drop one conversation's own selection, so it follows the default again.
     * The escape hatch for a conversation that pinned a default it can no longer
     * turn off.
     */
    resetContext(sessionId: string): Promise<{
        table: string;
        selection: {
            sessionId: string;
            selected: string[];
            configured?: boolean;
        };
        applied: boolean;
        error?: string;
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