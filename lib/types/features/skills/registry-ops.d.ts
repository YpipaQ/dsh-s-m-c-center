/**
 * Registry operations: importing external skills, dropping them, the
 * traceability pass, and the per-skill announcement flag.
 *
 * The registry is the ledger for skills that stay where they are, so these are
 * the flows that do *not* move anything — importing records a path, and the
 * refresh pass only checks whether that path is still there.
 * @module
 */
import type { SkillGroup } from '../../shared/protocol/index.ts';
/**
 * Register external skills: the canonical copy stays where it is, only a
 * record goes into `skills-registry.json`. This is the flow for "skills in
 * arbitrary directories" per the four-group model.
 *
 * Per-item failures are collected rather than thrown, so one bad pick does not
 * abandon the rest of the batch.
 */
export declare function registerExternal(items: Array<{
    sourcePath: string;
    kind: 'bundle' | 'file';
}>): Array<{
    name: string;
    ok: boolean;
    reason?: string;
}>;
/** Drop a registry entry (and its link, when one exists). */
export declare function unregisterExternal(slug: string): void;
/**
 * Walk the registry and refresh `lastSeen`: the cheap traceability pass that
 * only checks whether the canonical path still exists — no content parsing.
 */
export declare function refreshRegistry(): Array<{
    slug: string;
    name: string;
    exists: boolean;
}>;
/** The announcement flag for one skill, from whichever ledger holds it. */
export declare function setAnnounce(group: SkillGroup, slug: string, announce: boolean): void;
/**
 * The registry entry a given skill path belongs to, for the delete flow.
 *
 * Matches the entry's own directory (so a bundle's SKILL.md resolves to it) or
 * the path itself (a flat `.md` row).
 */
export declare function registryEntryForDelete(path: string): import("../../shared/protocol/skills.ts").RegistryEntry | undefined;
//# sourceMappingURL=registry-ops.d.ts.map