/**
 * The dsh-s-m-c-center settings section: a first-class settings page (a
 * `settings.section` entry, a sibling of the Plugins page) that renders the
 * tool-management UI directly. The plugin does NOT read its own settings
 * namespace (third-party namespaces are not exposed to the browser settings
 * surface), so there is no master-switch here; the manager is always shown.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Props the renderer binds for the section. */
export type SkillsMcpSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'dsh-s-m-c-center'> & InjectFace<{
    pickDirectory: () => Promise<string | null>;
}>;
/**
 * Render the settings section content.
 * @param props - locale copy, the global useWorkspaces hook, and the picker helper.
 * @returns the section page.
 */
export declare function SkillsMcpSection(props: SkillsMcpSectionProps): import("react").JSX.Element;
//# sourceMappingURL=SettingsCard.d.ts.map