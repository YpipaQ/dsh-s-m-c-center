/**
 * Browser-half entry: everything that runs inside the dsh web GUI.
 *
 * Registers this plugin's locale dictionary and contributes two things: a
 * `settings.section` — a whole page, sibling to the Plugins page, not a card
 * inside a group — and a `sidebar.footer.action`, the sidebar-foot row that
 * opens the conversation-skills window. The manager UI lives behind that page
 * and reaches the host through the `/api/dsh-s-m-c-center` routes.
 *
 * Both contributions are declarative slots. Neither guesses at the shell's DOM
 * nor re-anchors itself after a re-render: the shell owns where they sit, how
 * they collapse with the column, and when they are remounted.
 *
 * The settings scope is deliberately left unbound: third-party namespaces are
 * not exposed to the browser's configuration surface, so a scope-backed
 * section would render an empty shell. The page is shown directly instead.
 *
 * Mounting is best-effort on purpose — the web shell tears its whole boot down
 * when a plugin's apply throws, and an external plugin has no business doing
 * that to the GUI.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { mountConversationPanel } from './shell/sidebar.ts'
import { SidebarEntry } from './shell/SidebarEntry.tsx'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge (remote.directoryPicker) and the global
// useWorkspaces standard hook merge (ui-workspace) into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
// Type-only: pulls the slots merge tables (SlotMap / LocaleNamespaceMap).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type SkillsMcpKey } from './shared/locales.ts'
import { SkillsMcpSection } from './shell/SettingsCard.tsx'

/** Locale namespace this plugin owns. */
const NS = 'dsh-s-m-c-center'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-s-m-c-center surface copy. */
    'dsh-s-m-c-center': SkillsMcpKey
  }
}

/** Required services (fiber inject waiting — the runtime must be up first).
 * `settings.section` itself is declared by the settings shell, so mounting
 * only waits on the services this page actually reads. */
export const inject = ['slots', 'locale', 'remote', 'remote.directoryPicker']

/**
 * Mount the settings page.
 * @param ctx - client root context (slots, locale, remote).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-s-m-c-center: dictionaries')

  // The floating window's lifetime: its stylesheet, and the window itself. The
  // *entry* that opens it is a slot occupant below, so the shell owns mounting
  // that button — a failure here must never take the settings card down.
  ctx.effect(() => mountConversationPanel(), 'dsh-s-m-c-center: conversation panel')

  // The sidebar foot, directly above Settings and beside the shell's own footer
  // action. `order: -10` puts this row first in that flex row, which is the only
  // position it can occupy: the shell's action is a full-width flex item, so a
  // later order would be pushed past the column edge instead of shrinking.
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'conversation-skills',
    order: -10,
    label: () => ctx.locale.bind(NS)('panelTitle'),
    locale: NS,
  }, SidebarEntry))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills-mcp',
    order: 20,
    label: () => ctx.locale.bind(NS)('title'),
    locale: NS,
    inject: () => ({
      pickDirectory: async (): Promise<string | null> => {
        // DSH 0.1.2-alpha.2 moved directory picking off ctx.workspaces onto
        // the remote.directoryPicker Remote namespace.
        const result = await ctx.remote.directoryPicker.pick()
        if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`)
        return result.value
      },
    }),
  }, SkillsMcpSection))
}
