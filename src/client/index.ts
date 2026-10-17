/**
 * Browser-half entry: everything that runs inside the dsh web GUI.
 *
 * Registers this plugin's locale dictionary and contributes two things: a
 * `settings.section` — a whole page, sibling to the Plugins page, not a card
 * inside a group — and the sidebar row under New Session that opens the
 * conversation-skills window. The manager UI lives behind that page and reaches
 * the host through the `/api/dsh-s-m-c-center` routes.
 *
 * The page is a declarative slot. The row is anchored: the shell declares no
 * slot above the workspaces region, so it is placed after New Session and
 * re-asserted whenever the shell re-renders the sidebar.
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
import { mountConversationPanel, mountSidebarEntry } from './shell/sidebar.ts'
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
import { pickFromResult } from './shared/picker.ts'
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

  // The floating window's lifetime: its stylesheet, and the window itself.
  ctx.effect(() => mountConversationPanel(), 'dsh-s-m-c-center: conversation panel')

  // The sidebar entry, directly under New Session. Anchored rather than seated:
  // the shell declares no slot above the workspaces region. A failure here must
  // never take the settings page down with it, so mounting is best-effort.
  mountSidebarEntry(ctx, ctx.locale.bind(NS))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills-mcp',
    order: 20,
    label: () => ctx.locale.bind(NS)('title'),
    locale: NS,
    inject: () => ({
      pickDirectory: async (): Promise<string | null> => {
        // DSH 0.1.2-alpha.2 moved directory picking off ctx.workspaces onto
        // the remote.directoryPicker Remote namespace. The result mapping lives
        // in picker.ts so the "no native chooser here" case is testable.
        return pickFromResult(await ctx.remote.directoryPicker.pick())
      },
    }),
  }, SkillsMcpSection))
}
