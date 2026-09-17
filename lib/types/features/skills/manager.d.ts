/**
 * The skills feature's public surface — one object the rest of the plugin
 * (routes, announcement, context engine) talks to.
 *
 * Everything above this file is either a pure helper or a ledger; this is where
 * they compose into the operations the UI actually calls. Keeping the facade
 * thin is the point of the split: each method below should read as one
 * sentence, and the work it delegates to should be findable by name.
 *
 * Identity note: `slug` is the cross-ledger key (store manifest, registry, link
 * ledger all agree on it), while `path` is where the document physically sits.
 * Rows carry both because either may be the only one known.
 * @module
 */
import type { ScannedSkill, SkillDetail, SkillSource, SkillSummary, SkillLinks, SkillsRegistry, StoreIndex, StoreOperation, StoreStatus, VerifyResult } from '../../shared/protocol/index.ts';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
/**
 * The skills engine, as the rest of the plugin sees it.
 *
 * A class rather than a module of functions so routes and the announcement can
 * hold one reference and a test can point it at a scratch `$DSH_STORE_ROOT`
 * without touching global state.
 */
export declare class SkillsManager {
    /** The skills directory (created on demand inside the unified store root). */
    storeDir(): string;
    /** Read the store manifest, rebuilding it from disk when missing or corrupt. */
    readStoreIndex(): StoreIndex;
    /** Write the manifest atomically (temp file + rename). */
    writeStoreIndex(index: StoreIndex): void;
    /** Rebuild the manifest from whatever bundles exist in the store directory. */
    recoverIndex(): StoreIndex;
    /** Read the external-skills registry, tolerating a missing or corrupt file. */
    readRegistry(): SkillsRegistry;
    /** Read the link ledger, tolerating a missing or corrupt file. */
    readLinks(): SkillLinks;
    /** Repoint every ledger-tracked link pointing into `from` at `to`. */
    relinkSkills(from: string, to: string): number;
    /** Create (or confirm) the link for a stored or registered skill. */
    linkSkill(slug: string): void;
    /** Remove the link for a skill (the canonical copy is never touched). */
    unlinkSkill(slug: string): void;
    /** Verify a link: resolves? target alive? tracked? */
    verifyLink(slugOrPath: string): VerifyResult;
    /** Delete a link the ledger has no record of. */
    deleteUntrackedLink(linkPath: string): void;
    /** Move a native skill into the store and link it back. Returns the slug. */
    migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string;
    /** Undo a migration. Returns the path the skill went back to. */
    unmigrate(slug: string): string;
    /** Register external skills in place (the canonical copy does not move). */
    registerExternal(items: Array<{
        sourcePath: string;
        kind: 'bundle' | 'file';
    }>): {
        name: string;
        ok: boolean;
        reason?: string;
    }[];
    /** Drop a registry entry (and its link, when one exists). */
    unregisterExternal(slug: string): void;
    /** Traceability pass: does every registered canonical path still exist? */
    refreshRegistry(): {
        slug: string;
        name: string;
        exists: boolean;
    }[];
    /** List every skill across the four groups. */
    listSkills(cwd?: string): SkillSummary[];
    /** Read one skill document (body included). */
    readSkill(path: string): SkillDetail | null;
    /** Resolve a slug to a runtime registration for the context engine. */
    resolveRegistration(slug: string): SkillRegistration | undefined;
    /** Scan a picked directory for import candidates. */
    scanSkills(dir: string): ScannedSkill[];
    /** Delete a skill wherever it lives. Returns the removed path. */
    deleteSkill(path: string, kind: 'bundle' | 'file'): string;
    /** One-shot adoption of user-level native skills into the store. */
    migrate(): StoreOperation;
    /** Undo {@link migrate}: restore every stored skill to its original path. */
    rollbackMigration(): StoreOperation;
    /** Run the one-shot migration again (the uninstall page's undo). */
    reMigrate(): StoreOperation;
    /** Store state for the UI banner. */
    storeStatus(): StoreStatus;
}
/** Re-exported so routes can report a store that has no bundles yet. */
export declare function storeHasBundles(): boolean;
//# sourceMappingURL=manager.d.ts.map