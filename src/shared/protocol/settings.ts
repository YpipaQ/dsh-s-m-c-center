/**
 * Settings half of the wire contract.
 *
 * The context engine's `ContextSelection` deliberately does *not* live here:
 * it is the engine's own document shape, owned by
 * `src/features/context/engine.ts`, and only its listing rows cross the wire
 * (built inline by the route from `listSelections`).
 * @module
 */

/** The plugin's own config (mirrors the host-side `Config` schema). */
export interface ManagerSettings {
  /** Master switch: routes, MCP connections, prompt section. */
  enabled: boolean
  /** Announce the plugin to every agent's system prompt. */
  announceToAgent: boolean
}
