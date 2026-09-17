/**
 * The one-shot adoption migration (and its rollback / re-run).
 *
 * First launch after the store landed moves every user-level native skill into
 * `S-M-C/skills` and leaves a link behind. Project-level skills are never
 * touched — they belong to their repository.
 *
 * Idempotent by a flag in the manifest (`migratedAt`), and best-effort
 * throughout: a skill that cannot be moved is collected as a failure and left
 * in place, still usable, because refusing to mount would be worse. The status
 * route surfaces whatever is left over.
 * @module
 */
import type { StoreOperation, StoreStatus } from '../../shared/protocol/index.ts';
/**
 * One-shot migration: move every user-level native skill into the store and
 * link it back from `~/.dsh/skills`. Project-level skills stay in place.
 * Idempotent; individual failures are collected, not thrown.
 */
export declare function migrate(): StoreOperation;
/**
 * Undo {@link migrate}: restore every stored skill to its original path
 * (removing links along the way) and drop the manifest.
 */
export declare function rollbackMigration(): StoreOperation;
/**
 * Undo a rollback: run the one-shot migration again (the uninstall page's
 * "undo" for the skills half of 归还).
 */
export declare function reMigrate(): StoreOperation;
/** Store state for the UI banner. */
export declare function storeStatus(): StoreStatus;
//# sourceMappingURL=migration.d.ts.map