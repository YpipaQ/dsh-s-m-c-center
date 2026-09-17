/**
 * The external-skills registry (`S-M-C/skills-registry.json`) — group 3's
 * ledger, and the home of the announcement flag for native skills.
 *
 * A row here means "this skill exists, keep an eye on it" without moving it:
 * the canonical copy stays wherever the user pointed. Two kinds share the file:
 * `external` rows come from the import flow, `native` rows are written
 * automatically the first time a scan finds a real skill in a scanned root —
 * which is what gives a native skill somewhere to store its 公告 / 隐藏 flag
 * without touching its SKILL.md.
 * @module
 */
import type { RegistryEntry, SkillsRegistry } from '../../shared/protocol/index.ts';
/** An empty registry. */
export declare function emptyRegistry(): SkillsRegistry;
/** Read the external-skills registry, tolerating a missing or corrupt file. */
export declare function readRegistry(): SkillsRegistry;
/** Write the registry atomically. */
export declare function writeRegistry(reg: SkillsRegistry): void;
/** Replace (or insert) one registry entry. */
export declare function upsertRegistryEntry(entry: RegistryEntry): void;
/** Drop one registry entry by slug. */
export declare function dropRegistryEntry(slug: string): void;
/** Registry entry for one slug, when present. */
export declare function registryEntryOf(slug: string): RegistryEntry | undefined;
/**
 * Registry entry whose canonical path matches `resolved`, when present.
 *
 * Matches the entry's own directory (a bundle's parent for a file row) and
 * anything beneath it, so a link pointing at `bundle/sub` still resolves to the
 * skill that owns `bundle`.
 */
export declare function registryEntryOfByPath(resolved: string): RegistryEntry | undefined;
//# sourceMappingURL=registry.d.ts.map