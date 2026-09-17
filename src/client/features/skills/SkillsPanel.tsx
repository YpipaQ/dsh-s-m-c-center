/**
 * Skills tab view — one list, four groups.
 *
 * Every row shows which of the four groups it belongs to (native / stored /
 * registered / the link state as its own flag) and offers exactly the
 * operations its group allows:
 *
 * - native:      迁移入库 (canonical copy → store, link back in place) / delete
 * - stored:      联接 / 删除 (the copy stays in the store)
 * - registered:  联接 / 取消登记 / delete (the external copy stays)
 * - untracked:   a link on disk with no ledger record — red flag, with
 *                验证 / 删除联接 instead of the normal actions
 *
 * Migration is deliberately one-way here. Undoing it is an uninstall-time
 * concern, so the bulk 撤销迁移 lives on the Guide tab's uninstall prep.
 *
 * Pure presentation over {@link useSkills}: it owns no state beyond the scan
 * section and never calls the API directly.
 */
import { useState } from 'react'
import { Badge, Button, EmptyState, ErrorText, Loading } from '../../shared/ui.tsx'
import type { UseSkillsResult } from './useSkills.ts'
import type { UseContextsResult } from './useContexts.ts'
import { format, sourceLabel } from '../../shared/format.ts'
import type { SkillGroup } from '../../../shared/protocol/index.ts'
import type { SkillsMcpKey, Translate } from '../../shared/locales.ts'
import css from '../../shared/settings-card.module.css'

export interface SkillsPanelProps {
  skills: UseSkillsResult
  contexts: UseContextsResult
  t: Translate
}

/** Locale key per group badge. */
const GROUP_KEY: Record<SkillGroup, SkillsMcpKey> = {
  native: 'groupNative',
  stored: 'groupStored',
  registered: 'groupRegistered',
}

/** Skills tab. */
export function SkillsPanel({ skills, contexts, t }: SkillsPanelProps) {
  return (
    <div className={css.panel}>
      <ContextSection contexts={contexts} t={t} />

      <div className={css.inline}>
        <div className={css.hGrow}>{t('skillList')}</div>
        <Button onClick={skills.reload} disabled={skills.refreshing}>{t('refresh')}</Button>
      </div>
      <Toolbar skills={skills} t={t} />
      <Messages skills={skills} />
      <SkillList skills={skills} t={t} />
      <RegisterSection skills={skills} t={t} />
    </div>
  )
}

/** Search box. */
function Toolbar({ skills, t }: { skills: UseSkillsResult; t: Translate }) {
  return (
    <div className={css.inline}>
      <input
        className={css.inputGrow}
        placeholder={t('phSearchSkill')}
        value={skills.query}
        onChange={(e) => { skills.setQuery(e.target.value) }}
      />
    </div>
  )
}

/** Errors and transient action feedback. */
function Messages({ skills }: { skills: UseSkillsResult }) {
  return (
    <>
      {skills.message ? <ErrorText>{skills.message}</ErrorText> : null}
      {skills.error ? <ErrorText>{skills.error}</ErrorText> : null}
    </>
  )
}

/**
 * Phase two: the workspace default skill selection, folded behind a toggle —
 * day-to-day the page is about the stored list, so the block stays collapsed.
 *
 * Only the default (`_default`) is offered: it is the selection every
 * conversation without a file of its own inherits, so it is the one a human
 * needs to set. A conversation's own selection is the agent's business — it
 * writes one through the `skill_select` tool at any time.
 */
function ContextSection({ contexts, t }: { contexts: UseContextsResult; t: Translate }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.collapsible}>
      <button type="button" className={css.collapsibleHead} onClick={() => { setOpen((v) => !v) }}>
        <span className={css.collapsibleChev}>{open ? '▾' : '▸'}</span>
        <span className={css.collapsibleLabel}>{t('contextTitle')}</span>
        <span className={css.collapsibleAction}>{format(t('contextCount'), { n: contexts.defaultCount })}</span>
        <span className={css.collapsibleAction}>{open ? t('collapse') : t('expand')}</span>
      </button>
      {open
        ? (
          <div className={css.section}>
            <div className={css.inline}>
              <div className={css.descWrap}>{t('contextNote')}</div>
            </div>
            <div className={css.inline}>
              <span className={css.note}>{t('contextDefaultItem')}</span>
              <Button onClick={contexts.reload}>{t('refresh')}</Button>
            </div>
            {contexts.message ? <ErrorText>{contexts.message}</ErrorText> : null}
            <div className={css.scanList}>
              {contexts.candidates.length === 0
                ? <div className={css.note}>{t('contextNoCandidates')}</div>
                : contexts.candidates.map((skill) => (
                  <div key={skill.slug ?? skill.path} className={css.row}>
                    <input
                      type="checkbox"
                      disabled={contexts.busySlug === (skill.slug ?? '')}
                      checked={!!contexts.checked[skill.slug ?? '']}
                      onChange={() => { contexts.toggle(skill.slug ?? '') }}
                    />
                    <div className={css.main}>
                      <div className={css.name}><span className={css.nameText}>{skill.name}</span></div>
                    </div>
                    <Badge>{t(skill.group === 'stored' ? 'groupStored' : skill.group === 'registered' ? 'groupRegistered' : 'groupNative')}</Badge>
                  </div>
                ))}
            </div>
          </div>
        )
        : null}
    </div>
  )
}

/** Pick-a-directory flow for registering external skills (copies stay put). */
function RegisterSection({ skills, t }: { skills: UseSkillsResult; t: Translate }) {
  const scan = skills.scan
  return (
    <>
      <div className={css.inline}>
        <div className={css.hGrow}>{t('registerSkill')}</div>
        <Button onClick={skills.refreshRegistry} disabled={skills.refreshing}>{t('refreshRegistry')}</Button>
      </div>
      <div className={css.inline}>
        <input
          className={css.inputGrow}
          placeholder={t('phRegisterDir')}
          value={scan.dir}
          onChange={(e) => { skills.setScanDir(e.target.value) }}
        />
        <Button onClick={skills.chooseDir}>{t('chooseFolder')}</Button>
        <Button disabled={scan.busy} onClick={skills.doScan}>
          {scan.busy ? t('scanning') : t('scanDir')}
        </Button>
      </div>
      {scan.error ? <ErrorText>{scan.error}</ErrorText> : null}
      {scan.items.length > 0
        ? (
          <div className={css.scanList}>
            {scan.items.map((it) => (
              <label key={it.sourcePath} className={css.row}>
                <input
                  type="checkbox"
                  disabled={it.oversize}
                  checked={!!scan.selected[it.sourcePath]}
                  onChange={() => { skills.toggleSelect(it.sourcePath) }}
                />
                <div className={css.main}>
                  <div className={css.name}>
                    <span className={css.nameText}>
                      {it.name}{it.kind === 'bundle' ? t('suffixDir') : t('suffixFile')}
                      {it.oversize ? t('suffixOversize') : ''}
                    </span>
                  </div>
                  {it.description ? <div className={css.desc}>{it.description}</div> : null}
                </div>
              </label>
            ))}
            <Button disabled={scan.busy} onClick={skills.doRegister}>
              {format(t('registerSelected'), { n: Object.keys(scan.selected).length })}
            </Button>
          </div>
        )
        : null}
      {scan.note ? <div className={css.note}>{scan.note}</div> : null}
    </>
  )
}

/** Grouped list of every skill, with the shared loading / empty states. */
function SkillList({ skills, t }: { skills: UseSkillsResult; t: Translate }) {
  if (skills.loading) return <Loading t={t} />
  if (skills.groups.length === 0) {
    return <EmptyState title={skills.query !== '' ? t('emptySkillMatch') : t('emptySkills')} />
  }
  return (
    <>
      {skills.groups.map((group) => (
        <div key={group.level}>
          <div className={css.groupH}>{group.label} ({group.items.length})</div>
          {group.items.map((skill) => (
            <SkillRow key={skill.path} skill={skill} skills={skills} t={t} />
          ))}
        </div>
      ))}
    </>
  )
}

interface SkillRowProps {
  skill: UseSkillsResult['filtered'][number]
  skills: UseSkillsResult
  t: Translate
}

/**
 * One row: group badge, source badge, and exactly the operations the row's
 * group allows.
 */
function SkillRow({ skill, skills, t }: SkillRowProps) {
  const isBusy = skills.busyPath === skill.path
  const isOpen = skills.detailPath === skill.path
  const redFlag = skill.untracked === true

  return (
    <div>
      <div className={css.row} style={redFlag ? { outline: '1px solid var(--dsh-danger, #d1242f)' } : undefined}>
        <div className={css.rowHead} style={{ cursor: 'pointer' }} onClick={() => { skills.view(skill) }}>
          <div className={css.name}>
            <span className={css.nameText}>
              {skill.name}
              {redFlag ? t('suffixUntracked') : ''}
            </span>
          </div>
          {skill.description ? <div className={css.desc}>{skill.description}</div> : null}
        </div>
        <Badge>{t(GROUP_KEY[skill.group])}</Badge>
        <Badge>{sourceLabel(skill.source)}</Badge>
        {redFlag
          ? (
            <>
              <Button disabled={isBusy} onClick={() => { skills.verify(skill) }}>{t('btnVerify')}</Button>
              <Button variant="danger" disabled={isBusy} onClick={() => { skills.deleteUntracked(skill) }}>
                {t('btnDeleteLink')}
              </Button>
            </>
          )
          : (
            <>
              {skill.group === 'native' && skill.level === 'user'
                ? <Button disabled={isBusy} onClick={() => { skills.migrate(skill) }}>{t('btnMigrate')}</Button>
                : null}
              {skill.group === 'registered'
                ? (
                  <Button disabled={isBusy} onClick={() => { skills.unregister(skill) }}>
                    {t('btnUnregister')}
                  </Button>
                )
                : null}
              {/* Link state owns exactly one button, coloured by direction:
                  green when pressing it links the skill in, red when it takes
                  the link away. Native rows are the skill itself — nothing to
                  link. */}
              {skill.group !== 'native'
                ? (skill.linked
                  ? (
                    <Button variant="danger" disabled={isBusy} title={t('tipUnlink')} onClick={() => { skills.unlink(skill) }}>
                      {t('btnUnlink')}
                    </Button>
                  )
                  : (
                    <Button variant="success" disabled={isBusy} title={t('tipLink')} onClick={() => { skills.link(skill) }}>
                      {t('btnLink')}
                    </Button>
                  ))
                : null}
            </>
          )}
        <Button onClick={() => { skills.view(skill) }}>{isOpen ? t('collapse') : t('details')}</Button>
        <Button variant="danger" disabled={isBusy} onClick={() => { skills.remove(skill) }}>
          {skills.confirmPath === skill.path ? t('confirmDelete') : t('delete')}
        </Button>
      </div>
      {isOpen ? <SkillDetail detail={skills.detail} path={skill.path} fallback={skill.description} t={t} /> : null}
    </div>
  )
}

interface SkillDetailProps {
  detail: UseSkillsResult['detail']
  path: string
  /** Description from the list row, shown if the detail payload lacks one. */
  fallback: string
  t: Translate
}

/** Expanded SKILL.md preview for one row. */
function SkillDetail({ detail, path, fallback, t }: SkillDetailProps) {
  const d = detail && detail.path === path ? detail.data : null
  return (
    <div className={css.detail}>
      {d === null
        ? <div>{t('loading')}</div>
        : d && d.error
          ? <div>{d.error}</div>
          : (
            <div>
              <div className={css.name}><span className={css.nameText}>{d.description || fallback}</span></div>
              {d.whenToUse ? <div className={css.desc}>{t('detailWhenToUse')}: {d.whenToUse}</div> : null}
              <pre className={css.pre}>{d.content || ''}</pre>
            </div>
          )}
    </div>
  )
}
