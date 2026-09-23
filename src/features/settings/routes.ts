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

import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SMC_API } from '../../shared/protocol/index.ts'
import { badRequest, handle, ok, writeJson } from '../../shared/http.ts'
import type { ManagerSettings } from '../../shared/protocol/index.ts'

/** What the settings routes need from the composition root. */
export interface SettingsRouteDeps {
  /** Read the plugin's own persisted settings. */
  readOwnSettings: () => ManagerSettings
  /** Persist new settings, then re-apply surfaces; returns what landed. */
  writeOwnSettings: (next: ManagerSettings) => ManagerSettings
}

/** Build the settings route table. */
export function settingsRoutes(deps: SettingsRouteDeps): WebRoute[] {
  return [
    handle('GET', SMC_API.settings, async (_req, res) => {
      writeJson(res, 200, ok({ settings: deps.readOwnSettings() }))
    }),

    // Merge rather than replace: the body carries only the switches the page
    // knows about, and a field it did not send must keep its stored value.
    handle('POST', SMC_API.settingsSave, async (_req, res, body) => {
      const raw = body?.settings
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        badRequest(res, 'settings object required')
        return
      }
      const incoming = raw as Record<string, unknown>
      const current = deps.readOwnSettings()
      const next: ManagerSettings = {
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : current.enabled,
        announceToAgent: typeof incoming.announceToAgent === 'boolean' ? incoming.announceToAgent : current.announceToAgent,
      }
      const applied = deps.writeOwnSettings(next)
      writeJson(res, 200, ok({ settings: applied }))
    }),
  ]
}
