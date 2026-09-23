/**
 * Guide tab. Two halves, in this order:
 *
 * 1. How the plugin works — one top-level heading per tool family (skills /
 *    MCP servers / local CLI tools) plus a "where the data lives" section, each
 *    explained by second-level topics. The copy that used to sit on the three
 *    management tabs lives here, so those tabs stay purely operational.
 * 2. Uninstall preparation — the escape hatch itself: give back skills ("撤销
 *    迁移" / "迁移"), inject every archived MCP server back, and list the files
 *    that must be removed by hand.
 *
 * The two heading levels are visually distinct on purpose (`.docH1` for the
 * families, `.groupH` for the topics inside them).
 *
 * Presentation over the skills/mcp hooks the shell already owns: this panel
 * triggers the shared API and asks the shell to bump its refresh counter, so
 * the other tabs stay in step without extra fetching.
 */
import { useState } from 'react'
import { Button, EmptyState, ErrorText } from '../../shared/ui.tsx'
import type { UseMcpResult } from '../mcp/useMcp.ts'
import type { UseSkillsResult } from '../skills/useSkills.ts'
import { api } from '../../shared/useApi.ts'
import { errorText, format } from '../../shared/format.ts'
import type { Translate } from '../../shared/locales.ts'
import css from '../../shared/settings-card.module.css'

export interface GuidePanelProps {
  skills: UseSkillsResult
  mcp: UseMcpResult
  /** Bump the shell's refresh counter so the other tabs refetch. */
  refresh: () => void
  t: Translate
}

/** A second-level topic: heading plus its paragraph. */
function Topic({ h, p }: { h: string; p: string }) {
  return (
    <>
      <div className={css.groupH}>{h}</div>
      <div className={css.descWrap}>{p}</div>
    </>
  )
}

/** Guide tab. */
export function GuidePanel({ skills, mcp, refresh, t }: GuidePanelProps) {
  const [busy, setBusy] = useState<'rollback' | 'migrate' | 'restore' | ''>('')
  const [message, setMessage] = useState('')

  const store = skills.store
  const storeRoot = store?.root || '~/.dsh/S-M-C'
  const storeCount = store?.count ?? 0
  const archivedCount = mcp.servers.filter((s) => s.archived).length

  // Conditional button: store populated → destructive rollback (red); store
  // empty but unmanaged skills on disk → constructive migration (green).
  const canRollback = storeCount > 0
  const canMigrate = storeCount === 0 && skills.userUnmanaged > 0
  const canRestoreMcp = archivedCount > 0
  const nothingToDo = !canRollback && !canMigrate && !canRestoreMcp

  const run = (which: 'rollback' | 'migrate' | 'restore', action: () => Promise<void>) => {
    setBusy(which)
    setMessage('')
    action()
      .catch((e) => { setMessage(errorText(e)) })
      .finally(() => { setBusy(''); refresh() })
  }

  const doRollback = () => run('rollback', async () => {
    const op = await api.rollbackStore()
    setMessage(op.failures.length === 0
      ? format(t('msgRollbackOk'), { moved: op.moved })
      : format(t('msgRollbackPartial'), { moved: op.moved, failed: op.failures.length }))
  })

  const doMigrate = () => run('migrate', async () => {
    const op = await api.reMigrateStore()
    setMessage(format(t('msgMigrateDone'), { moved: op.moved }))
  })

  const doRestore = () => run('restore', async () => {
    const restored = await api.restoreAllMcp()
    setMessage(format(t('msgRestoreDone'), { restored }))
  })

  return (
    <div className={css.panel}>
      <div className={css.section}>
        <div className={css.hGrow}>{t('panelGuide')}</div>
        <div className={css.descWrap}>{t('guideIntro')}</div>

        <div className={css.docH1}>{t('guideSkillsH')}</div>
        <Topic h={t('guideStoreH')} p={t('guideStoreP')} />
        <Topic h={t('guideEnableH')} p={t('guideEnableP')} />
        <Topic h={t('guideSessionH')} p={t('guideSessionP')} />

        <div className={css.docH1}>{t('guideMcpH')}</div>
        <Topic h={t('guideConnectH')} p={t('guideConnectP')} />
        <Topic h={t('guideArchiveH')} p={t('guideArchiveP')} />

        <div className={css.docH1}>{t('guideCliH')}</div>
        <Topic h={t('guideDiscoverH')} p={t('guideDiscoverP')} />
        <Topic h={t('guideAnnounceH')} p={t('guideAnnounceP')} />

        <div className={css.docH1}>{t('guideDataH')}</div>
        <div className={css.descWrap}>{t('guideDataP')}</div>
      </div>

      <div className={css.section}>
        <div className={css.docH1}>{t('panelUninstall')}</div>
        <div className={css.descWrap}>{t('uninstallIntro')}</div>
        {message ? <ErrorText>{message}</ErrorText> : null}
        {nothingToDo
          ? <EmptyState title={t('uninstallNothing')} />
          : (
            <>
              <div className={css.groupH}>{t('uninstallSkillsTitle')}</div>
              <div className={css.descWrap}>{t('uninstallSkillsNote')}</div>
              <div className={css.inline}>
                {canRollback
                  ? (
                    <Button variant="danger" disabled={busy !== ''} onClick={doRollback}>
                      {busy === 'rollback' ? t('rollingBack') : t('rollback')}
                    </Button>
                  )
                  : null}
                {canMigrate
                  ? (
                    <Button variant="success" disabled={busy !== ''} onClick={doMigrate}>
                      {busy === 'migrate' ? t('migratingSkills') : t('migrateSkills')}
                    </Button>
                  )
                  : null}
              </div>

              <div className={css.groupH}>{t('uninstallMcpTitle')}</div>
              <div className={css.descWrap}>{t('uninstallMcpNote')}</div>
              <div className={css.inline}>
                {canRestoreMcp
                  ? (
                    <Button variant="primary" disabled={busy !== ''} onClick={doRestore}>
                      {busy === 'restore' ? t('restoringMcp') : t('restoreAllMcp')}
                    </Button>
                  )
                  : null}
              </div>
            </>
          )}

        <div className={css.groupH}>{t('uninstallFilesTitle')}</div>
        <div className={css.descWrap}>{t('uninstallFilesNote')}</div>
        <div className={css.pathList}>
          <div className={css.pathMain}>{storeRoot}{store === null ? '' : '/'}</div>
          <div className={css.pathSub}>{t('uninstallFilesList')}</div>
        </div>
        <div className={css.descWrap}>{t('uninstallSettingsPath')}</div>
        <div className={css.descWrap}>
          {t('starNoteA')}{' '}
          <a className={css.starLink} href="https://github.com/YpipaQ/dsh-s-m-c-center" target="_blank" rel="noreferrer">
            ⭐ Star
          </a>{' '}
          {t('starNoteB')}
        </div>
      </div>
    </div>
  )
}
