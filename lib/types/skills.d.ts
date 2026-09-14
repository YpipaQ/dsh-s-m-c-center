/**
 * Skills filesystem engine — scans the four manageable skill roots, parses
 * SKILL.md frontmatter, and performs enable/disable, delete, scan-for-import,
 * and import. Runs in the Host process with direct node:fs access (a real npm
 * package no longer needs the shell+node hack the dynamic plugin used).
 *
 * Skills adopted into the store live in `~/.dsh/S-M-C/skills/<slug>/` as the
 * single canonical copy; enabling one writes a directory link back into its
 * source root (`~/.dsh/skills/<slug>`), disabling removes that link. dsh's own
 * scanner follows links (`skill-filesystem` `nodeEntryKind` stats a symlink
 * entry), so a linked skill is fully visible to the agent while an unlinked one
 * is invisible — and the SKILL.md itself is never rewritten.
 * @module
 */
import type { ImportItem, ImportResult, ScannedSkill, SkillDetail, SkillSource, SkillSummary, StoreIndex, StoreOperation, StoreStatus } from './protocol.ts';
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
 * can recognise an old layout and move it. New code uses `storeSkillsDir()`
 * from ./store.ts — the skills live under the unified S-M-C root now.
 */
export declare const STORE_DIR_NAME = "skills-store";
/** Resolve (and materialize) the user-level skill roots plus the store. */
export declare function getRoots(): SkillRoots;
/** Walk up from cwd to the nearest .git directory (the project root). */
export declare function findProjectRoot(cwd?: string): string;
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
    /** Which root currently holds a link for `slug`, if any. */
    private linkedSource;
    /** Replace (or insert) one manifest entry. */
    private upsertEntry;
    /** Drop one manifest entry. */
    private dropEntry;
    /**
     * Materialise the link for one stored skill. No-op when it already exists;
     * refuses to overwrite a real directory.
     */
    private linkInto;
    /**
     * Remove the link for one stored skill. Only ever removes a link — a real
     * directory is left alone so a stray path can never delete the store copy.
     */
    private unlinkFrom;
    /**
     * Repoint every link that targets `from` at `to`.
     *
     * A junction stores an absolute target string, so moving the store silently
     * breaks every link into it: the bundles are intact, but `~/.dsh/skills/x`
     * still names the old path and the agent stops seeing the skill entirely.
     * This is the repair step the store-root migration runs right after moving.
     * @param from - the old store directory (may no longer exist).
     * @param to - the new store directory.
     * @returns how many links were rebuilt.
     */
    relinkSkills(from: string, to: string): number;
    /**
     * Move one skill into the store as a bundle and (when enabled) link it back.
     *
     * The stored copy is normalised: any `disable-model-invocation` /
     * `user-invocable` flags are stripped, because from here on visibility is
     * decided by link presence alone — leaving the flags in place would keep a
     * re-enabled skill hidden from the model.
     */
    private adopt;
    /**
     * Resolve a skill path back to its store identity, or undefined when the
     * skill is not managed (still in place, toggled by frontmatter).
     */
    private resolveManaged;
    /** Manifest entry for one slug, when present. */
    private entryOf;
    /** Scan one skill root directory into SkillSummary records. */
    scanRoot(dir: string, source: SkillSource): SkillSummary[];
    /** The roots to walk for a listing, in display order: project, then user. */
    private scanTargets;
    /**
     * List skills across project and/or user roots, de-duplicated by path, plus
     * every stored skill that is currently unlinked (so it can be re-enabled).
     */
    listSkills(cwd?: string): SkillSummary[];
    /** Read one skill document (body included). */
    readSkill(path: string): SkillDetail | null;
    /**
     * Enable/disable a skill. Managed skills are linked/unlinked (their SKILL.md
     * is never touched); everything else still falls back to rewriting the
     * frontmatter invocation flags.
     */
    /**
     * The 1/2 axis: whether the skill is injected into the agent context.
     *
     * Always a frontmatter rewrite — including for store-managed skills, whose
     * canonical copy is reachable through the link, so dsh still reads its
     * frontmatter there. The A/B link axis is a separate control
     * ({@link setSkillLinked}) and is never touched here.
     */
    setSkillEnabled(path: string, enabled: boolean): void;
    /**
     * The A/B axis: whether a link to the canonical copy sits in the skill root.
     *
     * For a skill that is not adopted yet, turning A on means adopting it into
     * the store first (that is how an outside skill gains a link at all).
     * Removing the link (B) leaves the canonical copy in the store — the skill
     * simply stops being reachable, and its 1/2 switch locks to 2.
     */
    setSkillLinked(path: string, linked: boolean): void;
    /** Delete a skill: for managed ones, drop the link and the store copy. */
    deleteSkill(path: string, kind: 'bundle' | 'file'): string;
    /**
     * One-shot migration: move every user-level skill into the store and link
     * back the ones that were enabled. Project-level skills stay in place —
     * moving them into `$DSH_HOME` would detach them from the repository that
     * owns them.
     *
     * Idempotent: a second call is a no-op. Individual failures are collected
     * rather than thrown, and the offending skill is simply left where it was.
     */
    migrate(): StoreOperation;
    /**
     * Undo {@link migrate}: restore every stored skill to its original path and
     * drop the store manifest. The invocation flags are re-applied so a skill
     * that was disabled before the migration comes back disabled.
     */
    rollbackMigration(): StoreOperation;
    /**
     * Undo a rollback: run the one-shot migration again.
     *
     * This is the uninstall page's "undo" for the skills half of 归还 — a skill
     * given back to its original location can be re-adopted into the store at
     * any time. A rollback that fully succeeded deleted the manifest, so
     * {@link migrate} would re-run on its own; when failures kept the manifest
     * alive, the marker has to be cleared first or migrate() would no-op.
     */
    reMigrate(): StoreOperation;
    /** Store state for the UI banner. */
    storeStatus(): StoreStatus;
    /** Scan an arbitrary directory for importable skills. */
    scanSkills(dir: string): ScannedSkill[];
    /** Import selected skills into the store as enabled bundles. */
    importSkills(items: ImportItem[]): ImportResult[];
}
/**
 * Move a path, falling back to copy+delete when the source and destination sit
 * on different devices (rename cannot cross them).
 */
//# sourceMappingURL=skills.d.ts.map