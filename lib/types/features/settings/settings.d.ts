/**
 * Plugin-settings persistence for the manager's own config namespace
 * (`dsh-s-m-c-center`) inside ~/.dsh/settings.yaml.
 *
 * The official settings surface does not expose third-party namespaces to the
 * browser, so the card's "announce to agent" switch round-trips through a
 * host route that edits the YAML file directly. To avoid re-serializing the
 * whole document (and clobbering sibling plugins' nested structures), the
 * writer performs a surgical top-level-block replacement: only the
 * `dsh-s-m-c-center:` key's block is rewritten, every other line is kept
 * byte-for-byte.
 * @module
 */
import type { ManagerSettings } from '../../shared/protocol/index.ts';
/** The top-level settings key this plugin owns. */
export declare const SETTINGS_NAMESPACE = "dsh-s-m-c-center";
/**
 * The key builds before the rename wrote to. Installs from that era still carry
 * the block — {@link migrateSettingsNamespace} moves it over once.
 */
export declare const LEGACY_SETTINGS_NAMESPACE = "skills-mcp-manager";
/** Defaults, mirroring the host-side cordis schema in index.ts. */
export declare const DEFAULT_SETTINGS: ManagerSettings;
/** Path of the dsh settings document. */
export declare function settingsPath(): string;
/** Read the plugin's settings, falling back to defaults for anything missing. */
export declare function readSettings(): ManagerSettings;
/**
 * Replace (or append) the plugin's top-level block, leaving every other line
 * untouched. Creates the file (and its directory) when missing.
 * @param settings - the complete settings to persist.
 * @returns the path written.
 */
export declare function writeSettings(settings: ManagerSettings): string;
/** Ensure the settings directory exists before a write (defensive). */
export declare function ensureSettingsDir(): void;
/**
 * Rename a legacy settings block to the current key, in place.
 *
 * Only the block's first line changes, so every value the user ever set is
 * carried across untouched; the rest of the document is not even re-serialized.
 * If the current key is already present the stale block is simply dropped —
 * the live one wins.
 *
 * Idempotent: once there is nothing legacy left to find it does nothing.
 *
 * @returns true when the document was rewritten.
 */
export declare function migrateSettingsNamespace(): boolean;
//# sourceMappingURL=settings.d.ts.map