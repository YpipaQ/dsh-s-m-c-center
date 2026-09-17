/**
 * The roots the skills feature walks, and the primitive that tells a real
 * entry apart from a link.
 *
 * A skill can live in four places, and which one decides its level:
 * project-level roots are derived from the workspace cwd, user-level roots
 * from the home directory. Only the user-level roots are ever adopted into the
 * store — project skills are meant to travel with their repository.
 * @module
 */
import type { Dirent } from 'node:fs';
import type { SkillSource } from '../../shared/protocol/index.ts';
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
 * True when `child` is `parent` or lives beneath it.
 *
 * Case-insensitive on Windows, where the same directory has many spellings and
 * a case-sensitive compare would report a store copy as "outside the store".
 */
export declare function inside(parent: string, child: string): boolean;
/** True when `path` is a symlink or a Windows junction. */
export declare function isLink(path: string): boolean;
/**
 * Link target, or undefined when `path` is a real file/directory.
 *
 * Returned raw (not resolved): callers always know the link's directory and
 * resolve against it, and `relinkSkills` needs the original string form.
 */
export declare function linkTarget(path: string): string | undefined;
/**
 * Resolve a directory entry to a usable kind, following links.
 *
 * A junction reports `isSymbolicLink()` and neither `isDirectory()` nor
 * `isFile()`, so a naive scan silently skips every linked skill. This mirrors
 * dsh's own `nodeEntryKind` so the UI and the agent agree on what exists.
 */
export declare function entryKind(fullPath: string, entry: Dirent): 'directory' | 'file' | undefined;
/** Resolve (and materialize) the user-level skill roots plus the store. */
export declare function getRoots(): SkillRoots;
/** Walk up from cwd to the nearest .git directory (the project root). */
export declare function findProjectRoot(cwd?: string): string;
/** Project-level sources are the ones that belong to a workspace. */
export declare function levelOf(source: SkillSource): 'project' | 'user';
/**
 * The roots to walk for a listing, in display order: project, then user.
 *
 * Order matters — it is the tie-breaker when two roots hold a skill of the
 * same name, and the caller sorts by the entries' `source` afterwards anyway.
 */
export declare function scanTargets(cwd?: string): Array<{
    path: string;
    source: SkillSource;
}>;
/**
 * Every slug-shaped name directly under a directory, dotfiles excluded.
 *
 * Used where a collision-free slug is needed (the store, a registry scan):
 * a missing or unreadable directory yields an empty list rather than throwing,
 * because the caller is about to create it anyway.
 */
export declare function childNames(dir: string): string[];
//# sourceMappingURL=roots.d.ts.map