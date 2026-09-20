/**
 * The CLI registry document (`S-M-C/cli.json`) and the entry shape it holds.
 *
 * `enabled` here means "公告给 Agent" — advertised in the announcement — not
 * "running". This plugin cannot start or stop a CLI, because the system owns
 * the executable; the flag is the only two-state control it has.
 *
 * The document is hand-editable, so `enabled` is read through a lenient
 * coercion and always written back as a real boolean. That matters: a plain
 * `!== false` check would treat the *string* `"false"` as true and silently
 * promote a hidden CLI into the announcement.
 * @module
 */
import type { CliRegistryEntry, NormalizedCliEntry } from '../../shared/protocol/index.ts';
/**
 * The first-boot seed: a single virtual hint row explaining the list, in place
 * of fake default CLI entries (the old gh/git/tencent-news-cli trio could
 * never be deleted and named tools the machine may not even have). It is a
 * real, deletable registry row — the UI renders it as an explanation.
 */
export declare const DEFAULT_REGISTRY: CliRegistryEntry[];
/** Coerce a cli-state boolean (JSON boolean or the string "true"/"false"). */
export declare function toBool(value: unknown): boolean | undefined;
/** The store's CLI registry path (kept with the rest of the S-M-C data). */
export declare function cliConfigPath(): string;
/** Read the persisted registry document (never throws). */
export declare function readCliConfig(): {
    entries: CliRegistryEntry[];
};
/** Persist the registry document (creating the directory when needed). */
export declare function writeCliConfig(data: {
    entries: CliRegistryEntry[];
}): void;
/** Validate one registry entry; returns an error string, or null when valid. */
export declare function validateCliEntry(entry: unknown): string | null;
/**
 * Normalize a registry entry to its persisted shape.
 *
 * The flag is resolved through {@link toBool} so a hand-edited cli.json
 * carrying `"false"`, `"0"` or `0` is read as 隐藏 instead of being silently
 * promoted to 公告. Anything unrecognized (missing, null, garbage) falls back
 * to the default: 隐藏 — a CLI only reaches the agent through the announcement,
 * so opting in has to be deliberate. The value written back is always a real
 * boolean, so read and write agree on the shape and no invalid state can
 * survive a save.
 */
export declare function normalizeCliEntry(entry: CliRegistryEntry): NormalizedCliEntry;
/**
 * The registry entries as persisted. The built-ins are seeded exactly once —
 * when the document does not exist yet — and the seed is written back, so the
 * file from then on is the single source of truth.
 *
 * The seed must never re-arm on an empty document: an empty `entries` array is
 * what a user gets after deleting the last built-in, and re-seeding there
 * would resurrect the defaults on the next read, making them undeletable (the
 * reported bug: the three built-in rows always came back). First boot seeds;
 * after that, whatever the user leaves in the file is what the list shows.
 */
export declare function persistedEntries(): CliRegistryEntry[];
//# sourceMappingURL=registry.d.ts.map