/**
 * Deleting a skill, wherever it lives.
 *
 * Three destinations, three different meanings of "delete" — which is the
 * whole reason this is one function rather than three call sites:
 *
 * - **native** — the real file/directory goes. This is the only irreversible
 *   operation in the plugin.
 * - **stored** — the link, its ledger record, the manifest entry and the store
 *   copy all go.
 * - **registered** — the link and the record go; the external canonical copy
 *   is left alone, because the plugin never owned it.
 *
 * The path may arrive as a link's target rather than the link itself, so the
 * first branch identifies the skill by link target and never follows the path:
 * an `rm -rf` through a junction would gut the store copy behind it.
 * @module
 */
/**
 * Delete a skill wherever it lives.
 * @returns the path that was removed (or the link that was removed for a
 *   registered skill — the canonical copy survives).
 */
export declare function deleteSkill(path: string, kind: 'bundle' | 'file'): string;
//# sourceMappingURL=delete.d.ts.map