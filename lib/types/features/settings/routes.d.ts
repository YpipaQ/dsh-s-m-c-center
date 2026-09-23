/**
 * The `/settings` route family — the plugin's own config.
 *
 * dsh's settings surface does not expose third-party namespaces to the
 * browser, and since dsh 0.1.7 archives settings.yaml on upgrade (wiping
 * third-party blocks with it) the plugin does not write there at all any
 * more. The page's switches round-trip through here and the host persists
 * to `$STORE_ROOT/settings.json`.
 *
 * `writeOwnSettings` is injected rather than imported because applying a write
 * has side effects beyond this file: it re-applies the announcement (dropping
 * or registering the system-prompt section), which is the composition root's
 * business.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { ManagerSettings } from '../../shared/protocol/index.ts';
/** What the settings routes need from the composition root. */
export interface SettingsRouteDeps {
    /** Read the plugin's own persisted settings. */
    readOwnSettings: () => ManagerSettings;
    /** Persist new settings, then re-apply surfaces; returns what landed. */
    writeOwnSettings: (next: ManagerSettings) => ManagerSettings;
}
/** Build the settings route table. */
export declare function settingsRoutes(deps: SettingsRouteDeps): WebRoute[];
//# sourceMappingURL=routes.d.ts.map