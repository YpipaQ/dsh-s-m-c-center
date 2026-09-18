/**
 * The store manifest (`S-M-C/skills/index.json`) — group 2's ledger.
 *
 * One row per adopted skill: its slug, the name it had when adopted, and where
 * it came from (so an unmigrate can put it back). Link state is deliberately
 * *not* here — that belongs to the link ledger, and keeping them apart is what
 * lets a link be rebuilt without touching the manifest.
 *
 * A row is written in exactly one shape ({@link ENTRY_KEYS}). An earlier
 * version also kept a per-skill 公告 flag, a 启用 flag, a link flag and a
 * source id on every row; by the end none of them controlled anything (the 公告
 * switch was removed for precisely that reason), but a stale key in a
 * user-visible file reads as a live one — so every write drops them, and
 * {@link compactStoreIndex} converges a file that already carries them.
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
/** The only keys one manifest row may carry. */
export declare const ENTRY_KEYS: readonly string[];
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
/**
 * The manifest reduced to the shape this version writes: the top-level keys it
 * owns, and rows that carry nothing else. Idempotent by construction — feeding
 * its own output back returns an equal object.
 */
export declare function canonicalIndex(index: StoreIndex): StoreIndex;
/** Write the manifest atomically (temp file + rename), in canonical shape. */
export declare function writeStoreIndex(index: StoreIndex): void;
/**
 * Converge the manifest on disk onto the canonical shape, dropping keys an
 * older version left behind.
 *
 * Called once on mount: a write only ever touches one row, so a row that is
 * never adopted again would keep its dead keys forever. Idempotent — a file
 * that is already canonical is left alone, so this is free on every later boot.
 *
 * @returns whether the file changed, and the key names that were dropped.
 */
export declare function compactStoreIndex(): {
    changed: boolean;
    dropped: string[];
};
/** Replace (or insert) one manifest entry. */
export declare function upsertEntry(entry: StoreEntry): void;
/** Drop one manifest entry. */
export declare function dropEntry(slug: string): void;
/** Manifest entry for one slug, when present. */
export declare function entryOf(slug: string): StoreEntry | undefined;
/** Every manifest slug, for collision checks. */
export declare function storeSlugs(): string[];
//# sourceMappingURL=store-index.d.ts.map