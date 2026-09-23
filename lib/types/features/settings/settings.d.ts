/**
 * Plugin-settings persistence — now a JSON document inside the unified store
 * (`$STORE_ROOT/settings.json`), not dsh's `~/.dsh/settings.yaml`.
 *
 * Why the move: dsh 0.1.7 archives `~/.dsh/settings.yaml` to
 * `settings.yaml.imported` on upgrade, and every third-party block in it is
 * gone afterwards — a restart silently reset this plugin to its defaults. The
 * store is the one directory the plugin owns end to end, so the settings live
 * there now, next to the rest of the artefacts, and follow `DSH_STORE_ROOT`
 * like everything else.
 *
 * Migration is one-shot and best effort: when `settings.json` does not exist,
 * {@link migrateSettingsIntoStore} looks for the old `dsh-s-m-c-center:` (or
 * legacy `skills-mcp-manager:`) block first in `~/.dsh/settings.yaml` and then
 * in `settings.yaml.imported`, and carries whatever it finds into the JSON.
 * The host calls it once on mount, before anything reads the settings.
 * @module
 */
import type { ManagerSettings } from '../../shared/protocol/index.ts';
/** The settings key this plugin owned in dsh's settings.yaml. */
export declare const SETTINGS_NAMESPACE = "dsh-s-m-c-center";
/**
 * The key builds before the rename wrote to. Installs from that era still
 * carry the block — {@link migrateSettingsIntoStore} picks it up too.
 */
export declare const LEGACY_SETTINGS_NAMESPACE = "skills-mcp-manager";
/** Defaults, mirroring the cordis schema in setup.ts. */
export declare const DEFAULT_SETTINGS: ManagerSettings;
/**
 * Read the plugin's settings from the store document, falling back to the
 * defaults when it is missing or unreadable. Pure and idempotent: a missing
 * file is simply defaulted — the one-shot migration into the store is the
 * host's job on mount ({@link migrateSettingsIntoStore}), not this reader's.
 */
export declare function readSettings(): ManagerSettings;
/**
 * Persist the settings as the store's settings.json, creating the store
 * directory when needed.
 * @param settings - the complete settings to persist.
 * @returns the path written.
 */
export declare function writeSettings(settings: ManagerSettings): string;
/**
 * One-shot migration: carry the old dsh settings.yaml block into the store.
 *
 * Runs only when the store document does not exist yet, so it can never fight
 * live state. Candidates are tried in priority order (live settings.yaml
 * first, then the 0.1.7 archive); within a document the current namespace
 * wins over the legacy one. When nothing is found the defaults are written,
 * so the store document exists afterwards either way.
 *
 * Idempotent: once settings.json exists this does nothing.
 *
 * @returns true when the store document was written on this call.
 */
export declare function migrateSettingsIntoStore(): boolean;
//# sourceMappingURL=settings.d.ts.map