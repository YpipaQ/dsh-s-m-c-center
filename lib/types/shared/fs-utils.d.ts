/**
 * Filesystem primitives shared by every feature: containment tests, link
 * detection, cross-device moves, best-effort tree sizing.
 *
 * These are the operations more than one feature needs. Anything only one
 * feature uses stays next to that feature, so this module does not grow into a
 * junk drawer.
 * @module
 */
/**
 * Whether `child` sits inside `parent` (or *is* it).
 *
 * Path-prefix comparison alone is wrong — `/a/bc` must not count as inside
 * `/a/b` — so the check appends a separator and compares resolved paths.
 */
export declare function inside(parent: string, child: string): boolean;
/**
 * Whether the path is a symbolic link or a Windows junction.
 *
 * `lstatSync` sees a junction as a link, which is what every caller here wants:
 * the plugin creates junctions on Windows and symlinks elsewhere, and both must
 * read back as "a link".
 */
export declare function isLink(path: string): boolean;
/**
 * Absolute target of a link, or undefined when the path is not one (or the
 * target cannot be read).
 *
 * `readlinkSync` returns a relative target when the link was created that way;
 * resolving against the link's own directory makes the result comparable with
 * paths built elsewhere.
 */
export declare function linkTarget(path: string): string | undefined;
/**
 * Whether the path exists, links included and *not* followed.
 *
 * `lstatSync` rather than `statSync` on purpose: callers ask this about paths
 * that may be dangling links, and a dangling link is still an entry to clean up.
 */
export declare function exists(path: string): boolean;
/**
 * Move a file or directory, falling back to copy-then-delete across devices.
 *
 * `renameSync` is atomic and cheap but throws EXDEV when source and
 * destination live on different volumes — precisely what happens when the
 * store is relocated to another drive.
 */
export declare function movePath(from: string, to: string): void;
/**
 * Recursive on-disk size of a directory or file, in bytes.
 *
 * Stops accumulating once `limit` is passed so a pathological tree (or a link
 * loop) cannot make the caller hang: the answer is only ever compared against
 * an import cap, so "bigger than the cap" is as precise as it needs to be.
 * Unreadable entries count as zero rather than throwing.
 */
export declare function treeSize(path: string, limit?: number): number;
//# sourceMappingURL=fs-utils.d.ts.map