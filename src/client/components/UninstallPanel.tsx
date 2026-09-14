/**
 * Uninstall preparation tab. Two independent options:
 *
 * - Skills: when the store holds skills, "撤销迁移" (red, destructive) moves
 *   every bundle back to its original location; when the store is empty but
 *   unmanaged skills still sit in the user-level skills directories, the same
 *   slot turns into "迁移" (green, constructive) to bring them back into the
 *   store — so the action is always reversible in both directions.
 * - MCP: "MCP 全部注入" moves every archived definition back into the active
 *   document in one pass. No undo is provided: a server can be archived again
 *   individually at any time on the MCP tab.
 *
 * Below the actions, the store paths that must be removed by hand, since
 * plugin uninstall does not delete data.
 *
 * Presentation over the skills/mcp hooks the shell already owns: this panel
 * triggers the shared API and asks the shell to bump its refresh counter, so
 * the other tabs stay in step without extra fetching.
 */
import { useState } from 'react'
import { Button, EmptyState, ErrorText } from './ui/index.tsx'
import type { UseMcpResult } from '../hooks/useMcp.ts'
import type { UseSkillsResult } from '../hooks/useSkills.ts'
import { api } from '../hooks/useApi.ts'
import { errorText, format } from '../utils/format.ts'
import type { Translate } from '../locales.ts'
import css from '../settings-card.module.css'

export interface UninstallPanelProps {
  skills: UseSkillsResult
  mcp: UseMcpResult
  /** Bump the shell's refresh counter so the other tabs refetch. */
  refresh: () => void
  t: Translate
}

/** Uninstall prep tab. */
export function UninstallPanel({ skills, mcp, refresh, t }: UninstallPanelProps) {
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
        <div className={css.hGrow}>{t('panelUninstall')}</div>
        <div className={css.descWrap}>{t('uninstallIntro')}</div>
        {message ? <ErrorText>{message}</ErrorText> : null}
        {nothingToDo
          ? <EmptyState title={t('uninstallNothing')} />
          : (
            <>
              <div className={css.h}>{t('uninstallSkillsTitle')}</div>
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

              <div className={css.h}>{t('uninstallMcpTitle')}</div>
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
      </div>

      <div className={css.section}>
        <div className={css.h}>{t('uninstallFilesTitle')}</div>
        <div className={css.descWrap}>{t('uninstallFilesNote')}</div>
        <div className={css.pathList}>
          <div className={css.pathMain}>{storeRoot}{store === null ? '' : '/'}</div>
          <div className={css.pathSub}>{t('uninstallFilesList')}</div>
        </div>
        <div className={css.descWrap}>{t('uninstallSettingsPath')}</div>
      </div>
    </div>
  )
}
