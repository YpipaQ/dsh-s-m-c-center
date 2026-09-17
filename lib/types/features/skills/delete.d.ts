/**
 * Deleting a stored skill — the **only** delete this plugin performs.
 *
 * The rule is deliberately narrow: the canonical copy under
 * `~/.dsh/S-M-C/skills/<slug>/` is the one thing the plugin owns, so it is the
 * one thing it destroys. A native skill under a skills root is the user's own
 * file, and a registered skill lives in someone else's directory — both are
 * removed by their owner, or by migrating into the store first and deleting it
 * there.
 *
 * An earlier version took an arbitrary path plus a `kind` and `rm -rf`'d
 * `dirname(path)`. That made this route an unvalidated recursive-delete
 * primitive for any process on the machine (and a mis-sent `kind` was enough to
 * delete the wrong directory), so the entry point is now an identity — a store
 * slug — and the path is derived here. Nothing outside the store is ever
 * removed, and a store entry that turns out to be a link is refused rather than
 * followed.
 * @module
 */
/** Refusal shared with the route, which answers 400 with it. */
export declare const ONLY_STORE = "\u53EA\u80FD\u5220\u9664\u50A8\u5B58\u5E93\u91CC\u7684\u6280\u80FD\uFF1A\u8BE5\u76EE\u6807\u4E0D\u5728\u50A8\u5B58\u5E93\u5185\u6216\u4E0D\u662F\u6280\u80FD";
/**
 * Delete one stored skill: its link, its canonical copy, its manifest entry and
 * any registry record of it.
 * @param slug - the store directory name (a bare name, never a path).
 * @returns the bundle path that was removed.
 * @throws when `slug` is not a bare name, or when the store holds no skill by
 *   that name; the route turns both into a 400.
 */
export declare function deleteStored(slug: string): string;
//# sourceMappingURL=delete.d.ts.map