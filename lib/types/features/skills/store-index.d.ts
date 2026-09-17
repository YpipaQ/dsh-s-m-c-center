/**
 * The store manifest (`S-M-C/skills/index.json`) — group 2's ledger.
 *
 * One row per adopted skill: its slug, the name it had when adopted, and where
 * it came from (so an unmigrate can put it back). Link state is deliberately
 * *not* here — that belongs to the link ledger, and keeping them apart is what
 * lets a link be rebuilt without touching the manifest.
 *
 * Reads are defensive: a missing file rebuilds the manifest from whatever
 * bundles exist on disk, and a corrupt file is preserved as
 * `index.corrupt.json` before that rebuild, so a bad write never loses the
 * record silently.
 * @module
 */
import type { StoreEntry, StoreIndex } from '../../shared/protocol/index.ts';
/** File name of the manifest inside the skills directory. */
export declare const STORE_INDEX_NAME = "index.json";
/** Path of the store manifest. */
export declare function storeIndexPath(): string;
/** An empty manifest. */
export declare function emptyIndex(): StoreIndex;
/**
 * Rebuild the manifest from whatever bundles exist in the store directory.
 *
 * Used when index.json is missing (first run after a manual copy, or a corrupt
 * file) so adopted skills are not silently orphaned. No origin is recorded —
 * there is none to recover — which reads as "cannot be unmigrated".
 */
export declare function recoverIndex(): StoreIndex;
/**
 * Read the store manifest, rebuilding it from disk when missing or corrupt.
 * A corrupt file is kept as `index.corrupt.json` rather than deleted.
 */
export declare function readStoreIndex(): StoreIndex;
/** Write the manifest atomically (temp file + rename). */
export declare function writeStoreIndex(index: StoreIndex): void;
/** Replace (or insert) one manifest entry. */
export declare function upsertEntry(entry: StoreEntry): void;
/** Drop one manifest entry. */
export declare function dropEntry(slug: string): void;
/** Manifest entry for one slug, when present. */
export declare function entryOf(slug: string): StoreEntry | undefined;
/** Every manifest slug, for collision checks. */
export declare function storeSlugs(): string[];
//# sourceMappingURL=store-index.d.ts.map