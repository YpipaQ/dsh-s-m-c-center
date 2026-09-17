/**
 * Skills filesystem engine — the real-level manager behind the four groups:
 *
 * 1. **native** — skills sitting as real files/directories in a scanned root
 *    (`~/.dsh/skills`, `~/.agents/skills`, or the project roots). Migrating one
 *    moves the canonical copy into the store and replaces the original with a
 *    link.
 * 2. **stored** — canonical copies under `~/.dsh/S-M-C/skills/<slug>/` (with
 *    `index.json` as the manifest).
 * 3. **registered** — external skills whose canonical copy stays wherever the
 *    user pointed at; only a record in `skills-registry.json` marks them.
 * 4. **links** — the junctions themselves, always under `~/.dsh/skills`, every
 *    one of them written down in `skills-links.json` when created so it can be
 *    audited and precisely undone. A link found on disk without a ledger
 *    record is reported as untracked (red flag) instead of silently adopted.
 *
 * Every registration runs the same safety flow: walk the candidate directory
 * level by level until a SKILL.md shows up, require a parseable frontmatter
 * (name + description), and only then write the record. SKILL.md files are
 * never rewritten — visibility is decided by link presence, and the per-skill
 * announcement flag lives in the JSON ledgers, not in the file.
 * @module
 */
import type { ScannedSkill, SkillDetail, SkillGroup, SkillSource, SkillSummary, SkillLinks, SkillsRegistry, StoreIndex, StoreOperation, StoreStatus, VerifyResult } from './protocol.ts';
/** User-level skill roots (project roots are derived from the workspace cwd). */
export interface SkillRoots {
    home: string;
    dshHome: string;
    agentsHome: string;
    userSkillsDir: string;
    agentsSkillsDir: string;
    /** Canonical store holding one copy of every adopted skill. */
    storeDir: string;
}
/**
 * Directory name of the legacy store, kept only so {@link migrateStoreRoot}
 * can recognise an old layout and move it.
 */
export declare const STORE_DIR_NAME = "skills-store";
/** Resolve (and materialize) the user-level skill roots plus the store. */
export declare function getRoots(): SkillRoots;
/** Walk up from cwd to the nearest .git directory (the project root). */
export declare function findProjectRoot(cwd?: string): string;
/** Cap for one imported skill's on-disk size. */
export declare const MAX_SKILL_BYTES: number;
/** How deep {@link SkillsManager.scanSkills} descends below the picked root. */
export declare const SCAN_DEPTH = 2;
export declare class SkillsManager {
    /** The skills directory (created on demand inside the unified store root). */
    storeDir(): string;
    /**
     * Read the store manifest, rebuilding it from disk when missing or corrupt.
     * A corrupt file is kept as `index.corrupt.json` rather than deleted.
     */
    readStoreIndex(): StoreIndex;
    /** Write the manifest atomically (temp file + rename). */
    writeStoreIndex(index: StoreIndex): void;
    /**
     * Rebuild the manifest from whatever bundles exist in the store directory.
     * Used when index.json is missing (first run after a manual copy, or a
     * corrupt file) so adopted skills are not silently orphaned.
     */
    recoverIndex(): StoreIndex;
    /** Replace (or insert) one manifest entry. */
    private upsertEntry;
    /** Drop one manifest entry. */
    private dropEntry;
    /** Manifest entry for one slug, when present. */
    private entryOf;
    /** Read the external-skills registry, tolerating a missing or corrupt file. */
    readRegistry(): SkillsRegistry;
    /** Write the registry atomically. */
    private writeRegistry;
    /** Replace (or insert) one registry entry. */
    private upsertRegistryEntry;
    /** Drop one registry entry by slug. */
    private dropRegistryEntry;
    /** Registry entry for one slug, when present. */
    private registryEntryOf;
    /** Read the link ledger, tolerating a missing or corrupt file. */
    readLinks(): SkillLinks;
    /** Write the link ledger atomically. */
    private writeLinks;
    /** Ledger record for one link path, when present. */
    private linkRecordOf;
    /** Append one ledger record. */
    private trackLink;
    /** Remove the ledger record for one link path. */
    private untrackLink;
    /**
     * Create the link `~/.dsh/skills/<slug>` → `target` and write the ledger
     * record. Refuses to overwrite a real directory; a tracked link is a no-op.
     */
    private createLink;
    /**
     * Remove the link `~/.dsh/skills/<slug>` and its ledger record. Only ever
     * removes a link — a real directory is left alone so a stray path can never
     * delete real skills.
     */
    private removeLink;
    /** Which root currently holds a tracked/untracked link for `slug`, if any. */
    private linkedPath;
    /**
     * Repoint every ledger-tracked link that targets `from` at `to`.
     *
     * A junction stores an absolute target string, so moving the store silently
     * breaks every link into it. This is the repair step the store-root
     * migration runs right after moving.
     */
    relinkSkills(from: string, to: string): number;
    /**
     * Move one native skill into the store, link it back from
     * `~/.dsh/skills/<slug>`, record the link, and drop its registry entry
     * (the skill is a stored one now). The SKILL.md is copied verbatim — no
     * frontmatter rewriting, ever.
     * @returns the store slug.
     */
    migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string;
    /**
     * Undo a migration: remove the link, move the canonical copy back to its
     * origin, and drop the manifest entry. The registry entry is restored so
     * the announcement flag survives the round trip.
     */
    unmigrate(slug: string): string;
    /** Resolve a link path back to the skill it serves, or undefined. */
    private resolveByLink;
    /** Create (or confirm) the link for a stored or registered skill. */
    linkSkill(slug: string): void;
    /** Remove the link for a skill (the canonical copy is never touched). */
    unlinkSkill(slug: string): void;
    /**
     * Verify a link: does it still resolve, and does the target still hold a
     * parseable SKILL.md? Used by the UI for red-flagged (untracked) links.
     */
    verifyLink(slugOrPath: string): VerifyResult;
    /** Delete an untracked link (the ledger has no record of it). */
    deleteUntrackedLink(linkPath: string): void;
    /**
     * Register external skills: the canonical copy stays where it is, only a
     * record goes into `skills-registry.json`. This is the flow for "skills in
     * arbitrary directories" per the four-group model.
     */
    registerExternal(items: Array<{
        sourcePath: string;
        kind: 'bundle' | 'file';
    }>): Array<{
        name: string;
        ok: boolean;
        reason?: string;
    }>;
    /** Drop a registry entry (and its link, when one exists). */
    unregisterExternal(slug: string): void;
    /**
     * Walk the registry and refresh `lastSeen`: the cheap traceability pass that
     * only checks whether the canonical path still exists — no content parsing.
     */
    refreshRegistry(): Array<{
        slug: string;
        name: string;
        exists: boolean;
    }>;
    /** The announcement flag for one skill, from whichever ledger holds it. */
    setAnnounce(group: SkillGroup, slug: string, announce: boolean): void;
    /** Parse one SKILL.md (bundle) safely; undefined when it is not a skill. */
    private parseBundleDir;
    /** Parse one flat `.md` file safely; undefined when it is not a skill. */
    private parseFlatFile;
    /**
     * Walk one skill root and produce rows for everything found there. Real
     * directories/files become native rows (auto-registered); links become
     * linked rows whose group follows the link target (stored / registered),
     * or untracked red-flag rows when the ledger has no record of them.
     */
    private scanRootInto;
    /** Registry entry whose canonical path matches `resolved`. */
    private registryEntryOfByPath;
    /** The roots to walk for a listing, in display order: project, then user. */
    private scanTargets;
    /**
     * List every skill across the four groups, de-duplicated by path: native
     * roots first, then stored-but-unlinked rows, then registered-but-unlinked
     * rows. Announce flags come from the ledgers; link presence comes from the
     * filesystem cross-checked against the link ledger.
     */
    listSkills(cwd?: string): SkillSummary[];
    /** Read one skill document (body included). */
    readSkill(path: string): SkillDetail | null;
    /**
     * Delete a skill wherever it lives: native → the real file goes; stored →
     * link, ledger record, manifest entry and store copy all go; registered →
     * link and registry record go, the external canonical copy stays.
     */
    deleteSkill(path: string, kind: 'bundle' | 'file'): string;
    /**
     * One-shot migration: move every user-level native skill into the store and
     * link it back from `~/.dsh/skills`. Project-level skills stay in place.
     * Idempotent; individual failures are collected, not thrown.
     */
    migrate(): StoreOperation;
    /**
     * Undo {@link migrate}: restore every stored skill to its original path
     * (removing links along the way) and drop the manifest.
     */
    rollbackMigration(): StoreOperation;
    /**
     * Undo a rollback: run the one-shot migration again (the uninstall page's
     * "undo" for the skills half of 归还).
     */
    reMigrate(): StoreOperation;
    /** Store state for the UI banner. */
    storeStatus(): StoreStatus;
    /**
     * Scan an arbitrary directory for importable skills: the root plus two
     * levels of sub-directories, skipping anything bigger than 10 GB. Every
     * hit is a *registration* candidate — the canonical copy stays in place.
     */
    scanSkills(dir: string): ScannedSkill[];
}
//# sourceMappingURL=skills.d.ts.map