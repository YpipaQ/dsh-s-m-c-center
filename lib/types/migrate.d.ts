/**
 * One-shot migration into the unified store root (`~/.dsh/S-M-C`).
 *
 * Before the unified store the plugin scattered four artefacts across `$DSH_HOME`
 * (`skills-store/`, `mcp.json`, `mcp-archive.json`, `cli.json`). They belong
 * together, so this moves them — once — and leaves the old paths empty.
 *
 * The subtle part is the skills. A junction stores an *absolute* target, so
 * relocating the store invalidates every link that pointed into it: the bundles
 * survive the move but become invisible to the agent, which is worse than an
 * obvious failure. Step (3) therefore walks the skill roots and rebuilds any
 * link whose target sits under the old directory.
 *
 * Best effort throughout: a failure is collected and reported rather than
 * thrown, because the plugin failing to mount is a worse outcome than the
 * store being in a mixed state the status route can show.
 * @module
 */
import type { StoreFailure } from './protocol.ts';
import type { SkillsManager } from './skills.ts';
/** Result of one migration pass. */
export interface StoreRootMigration {
    /** Human-readable names of what moved (empty when there was nothing old). */
    moved: string[];
    /** Links repointed at the new skills directory. */
    relinked: number;
    /** Anything that could not be moved; the old path stays where it is. */
    failures: StoreFailure[];
}
/** Move the four legacy artefacts into the unified store root. */
export declare function migrateStoreRoot(skills: SkillsManager): StoreRootMigration;
//# sourceMappingURL=migrate.d.ts.map