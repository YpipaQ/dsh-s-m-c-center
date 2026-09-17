/**
 * Top-level manager shell: the announce-to-agent switch, the tab bar and the
 * active panel.
 *
 * The shell owns only navigation state (active tab, cross-tab refresh counter).
 * All data state lives in the per-tab hooks, so switching tabs is cheap and the
 * panels stay independent.
 */
import { useCallback, useState } from 'react'
import { Button, ErrorText, Switch } from '../shared/ui.tsx'
import { SkillsPanel } from '../features/skills/SkillsPanel.tsx'
import { McpPanel } from '../features/mcp/McpPanel.tsx'
import { CliPanel } from '../features/cli/CliPanel.tsx'
import { GuidePanel } from '../features/guide/GuidePanel.tsx'
import { useSkills } from '../features/skills/useSkills.ts'
import { useContexts } from '../features/skills/useContexts.ts'
import { useMcp } from '../features/mcp/useMcp.ts'
import { useCli } from '../features/cli/useCli.ts'
import { useManagerSettings } from '../shared/useManagerSettings.ts'
import { TAB_LABELS, TABS, type TabId } from '../shared/constants.ts'
import type { Translate } from '../shared/locales.ts'
import css from '../shared/settings-card.module.css'

export interface ManagerShellProps {
  /** Workspace cwd passed to project-scoped Host routes. */
  cwd: string
  /** Whether the plugin is enabled (routers/MCP/CLI probing active). */
  enabled: boolean
  /** Directory picker supplied by the dsh shell. */
  pickDirectory: () => Promise<string | null>
  /** Shell-bound translator for this plugin's namespace. */
  t: Translate
}

/** Skills / MCP / CLI manager root. */
export function ManagerShell({ cwd, enabled, pickDirectory, t }: ManagerShellProps) {
  const [tab, setTab] = useState<TabId>('skills')
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => { setRefreshKey((k) => k + 1) }, [])

  const settings = useManagerSettings()

  // All three hooks mount with the shell so a tab switch never refetches.
  const skills = useSkills({ cwd, refreshKey, pickDirectory, t })
  const contexts = useContexts({ cwd, refreshKey, skills: skills.filtered, t })
  const mcp = useMcp({ refreshKey, t })
  const cli = useCli({ cwd, refreshKey, t })

  const announceOn = settings.value?.announceToAgent ?? false
  const announceUnavailable = settings.loading || settings.saving || settings.value === null
  // Long explanatory copy folds into the title row: the 展开/收起 toggle sits
  // next to the title and switch, so no second "向 AI 公告" heading is needed.
  const [notesOpen, setNotesOpen] = useState(false)

  return (
    <div className={css.manager}>
      <div className={css.section} style={{ marginBottom: 12 }}>
        <div className={css.inline}>
          <div className={css.hGrow}>{t('announceTitle')}</div>
          <Button onClick={() => { setNotesOpen((v) => !v) }}>
            {notesOpen ? t('collapse') : t('expand')}
          </Button>
          <Switch
            checked={announceOn}
            disabled={announceUnavailable}
            onChange={settings.toggleAnnounce}
            label={settings.loading ? t('announceReading') : (announceOn ? t('announceOnState') : t('announceOffState'))}
          />
        </div>
        {/* One fact per line, shown only on demand: the switch's effect, its
            scope, and where it persists. */}
        {notesOpen
          ? (
            <div className={css.noteLines}>
              <div>{t('announceOnNote')}</div>
              <div>{t('announceOffNote')}</div>
              <div className={css.noteFoot}>
                {t('persistA')} <code>dsh-s-m-c-center</code> {t('persistB')} <code>~/.dsh/settings.yaml</code>
                {t('persistC')}
              </div>
            </div>
          )
          : null}
        {settings.error ? <ErrorText>{settings.error}</ErrorText> : null}
      </div>

      <div className={css.tabs} role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? css.tabActive : css.tab}
            onClick={() => { setTab(id) }}
          >
            {t(TAB_LABELS[id])}
          </button>
        ))}
      </div>

      {enabled
        ? null
        : (
          <p className={css.disabledBanner} role="status">
            {t('pluginDisabled')}
          </p>
        )}

      {tab === 'skills' ? <SkillsPanel skills={skills} contexts={contexts} t={t} /> : null}
      {tab === 'mcp' ? <McpPanel mcp={mcp} t={t} /> : null}
      {tab === 'cli' ? <CliPanel cli={cli} t={t} /> : null}
      {tab === 'guide' ? <GuidePanel skills={skills} mcp={mcp} refresh={bump} t={t} /> : null}
    </div>
  )
}
