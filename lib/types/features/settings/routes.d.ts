/**
 * The `/settings` route family — the plugin's own config block.
 *
 * This is the one namespace the browser cannot reach through dsh's own settings
 * API (third-party namespaces are not exposed), so the page's switches
 * round-trip through here and the host edits `~/.dsh/settings.yaml` directly.
 *
 * `writeOwnSettings` is injected rather than imported because applying a write
 * has side effects beyond this file: it re-adopts the persisted value as the
 * live source and re-applies the announcement (dropping or registering the
 * system-prompt section), which is the composition root's business.
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