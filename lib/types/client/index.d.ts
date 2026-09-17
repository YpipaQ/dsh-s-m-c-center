/**
 * Browser-half entry: everything that runs inside the dsh web GUI.
 *
 * Registers this plugin's locale dictionary and contributes one
 * `settings.section` — a whole page, sibling to the Plugins page, not a card
 * inside a group. The manager UI lives behind that page and reaches the host
 * through the `/api/dsh-s-m-c-center` routes.
 *
 * The settings scope is deliberately left unbound: third-party namespaces are
 * not exposed to the browser's configuration surface, so a scope-backed
 * section would render an empty shell. The page is shown directly instead.
 *
 * Mounting is best-effort on purpose — the web shell tears its whole boot down
 * when a plugin's apply throws, and an external plugin has no business doing
 * that to the GUI.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type SkillsMcpKey } from './shared/locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-s-m-c-center surface copy. */
        'dsh-s-m-c-center': SkillsMcpKey;
    }
}
/** Required services (fiber inject waiting — the runtime must be up first).
 * `settings.section` itself is declared by the settings shell, so mounting
 * only waits on the services this page actually reads. */
export declare const inject: string[];
/**
 * Mount the settings page.
 * @param ctx - client root context (slots, locale, remote).
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map