/**
 * Browser-side client for the `/api/dsh-s-m-c-center` route family.
 *
 * The only data path the tabs use: plain `fetch`, same origin, JSON in and
 * out. Every call funnels through {@link call} so the two failure modes a
 * route can produce — an HTTP status, or a 200 carrying `{ ok: false, error }`
 * — surface the same way, and a failure never arrives as a silent `undefined`.
 */
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary, ImportItem, ImportResult, ManagerSettings, McpServerConfig, McpServerSummary, ScannedSkill, SkillDetail, SkillSummary, StoreOperation, StoreStatus } from '../protocol.ts';
/** Raised for any route call that did not come back as `ok`. */
export declare class SkillsMcpApiError extends Error {
    constructor(message: string);
}
/** The browser half's only data entry point. */
export declare class SkillsMcpApi {
    listSkills(cwd: string): Promise<SkillSummary[]>;
    readSkill(path: string): Promise<SkillDetail>;
    toggleSkill(path: string, enabled: boolean): Promise<void>;
    /** The A/B axis: create (adopting first if needed) or remove the link. */
    setSkillLinked(path: string, linked: boolean): Promise<void>;
    deleteSkill(path: string, kind: 'bundle' | 'file'): Promise<void>;
    scanSkills(dir: string): Promise<ScannedSkill[]>;
    importSkills(items: ImportItem[]): Promise<ImportResult[]>;
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