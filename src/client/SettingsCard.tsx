/**
 * The dsh-s-m-c-center settings section: a first-class settings page (a
 * `settings.section` entry, a sibling of the Plugins page) that renders the
 * tool-management UI directly. The plugin does NOT read its own settings
 * namespace (third-party namespaces are not exposed to the browser settings
 * surface), so there is no master-switch here; the manager is always shown.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ManagerShell } from './components/ManagerShell.tsx'
import css from './settings-card.module.css'

/** Props the renderer binds for the section. */
export type SkillsMcpSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'dsh-s-m-c-center'>
  & InjectFace<{ pickDirectory: () => Promise<string | null> }>

/**
 * Render the settings section content.
 * @param props - locale copy, the global useWorkspaces hook, and the picker helper.
 * @returns the section page.
 */
export function SkillsMcpSection(props: SkillsMcpSectionProps) {
  const { t } = props

  // Current workspace path → project-level skills root. The alpha.2
  // WorkspaceSnapshot dropped the rc-era `recentWorkspaceId` marker; the
  // workspace list is Host-ordered, so the first row is the sensible default.
  const cwd = props.useWorkspaces((s) => s.items[0]?.path ?? '')

  return (
    <div className={css.sectionPage}>
      <h2 className={css.pageHeading}>{t('title')}</h2>
      <p className={css.pageIntro}>{t('description')}</p>
      {/* `t` is the shell-bound translator: every string below the page chrome
          comes from it, so an English shell renders no Chinese. */}
      <ManagerShell cwd={cwd} enabled={true} pickDirectory={props.pickDirectory} t={t} />
    </div>
  )
}
