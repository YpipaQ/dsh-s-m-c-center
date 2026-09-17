/**
 * Skills tab view — one list, four groups.
 *
 * Every row shows which of the four groups it belongs to (native / stored /
 * registered / the link state as its own flag), carries the per-skill
 * announcement switch, and offers exactly the operations its group allows:
 *
 * - native:      迁移入库 (canonical copy → store, link back in place) / delete
 * - stored:      联接 / 撤销迁移 (link + ledger + manifest go, copy returns) / delete
 * - registered:  联接 / 取消登记 / delete (the external copy stays)
 * - untracked:   a link on disk with no ledger record — red flag, with
 *                验证 / 删除联接 instead of the normal actions
 *
 * Pure presentation over {@link useSkills}: it owns no state beyond the scan
 * section and never calls the API directly.
 */
import { useState } from 'react'
import { Badge, Button, EmptyState, ErrorText, Loading, Switch } from './ui/index.tsx'
import type { UseSkillsResult } from '../hooks/useSkills.ts'
import type { UseContextsResult } from '../hooks/useContexts.ts'
import { format, sourceLabel } from '../utils/format.ts'
import type { SkillGroup } from '../../protocol.ts'
import type { SkillsMcpKey, Translate } from '../locales.ts'
import css from '../settings-card.module.css'

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
  const { store } = skills

  return (
    <div className={css.panel}>
      <ContextSection contexts={contexts} skills={skills} t={t} />

      {store !== null && store.migrated
        ? (
          <div className={css.storeNote}>
            <div className={css.noteLines}>
              <div>
                {format(t('storeMigrated'), { root: store.root || store.dir })}
                {' '}
                {format(t('storeCount'), { count: store.count, linked: store.linked })}
                {store.untracked > 0 ? ` · ${format(t('storeUntracked'), { n: store.untracked })}` : ''}
                {store.failures.length > 0 ? ` · ${format(t('storeFailures'), { n: store.failures.length })}` : ''}
              </div>
            </div>
          </div>
        )
        : null}

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

/** Search box + announce filter. */
function Toolbar({ skills, t }: { skills: UseSkillsResult; t: Translate }) {
  return (
    <div className={css.inline}>
      <input
        className={css.inputGrow}
        placeholder={t('phSearchSkill')}
        value={skills.query}
        onChange={(e) => { skills.setQuery(e.target.value) }}
      />
      <select
        className={css.filterSelect}
        value={skills.enabledFilter}
        onChange={(e) => { skills.setEnabledFilter(e.target.value as typeof skills.enabledFilter) }}
      >
        <option value="all">{t('filterAll')}</option>
        <option value="enabled">{t('filterEnabled')}</option>
        <option value="disabled">{t('filterDisabled')}</option>
      </select>
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
 * Phase two: per-conversation skill selection. A conversation starts with
 * everything unselected — the agent flips its own skills through the
 * `skill_select` tool, and this block edits any conversation that already
 * holds a selection.
 */
function ContextSection({ contexts, skills, t }: { contexts: UseContextsResult; skills: UseSkillsResult; t: Translate }) {
  return (
    <div className={css.section}>
      <div className={css.inline}>
        <div className={css.hGrow}>{t('contextTitle')}</div>
        <Button onClick={contexts.reload}>{t('refresh')}</Button>
      </div>
      <div className={css.descWrap}>{t('contextNote')}</div>
      {contexts.sessions.length === 0
        ? <EmptyState title={t('emptyContexts')} />
        : (
          <div className={css.inline}>
            <select
              className={css.filterSelect}
              value={contexts.activeId ?? ''}
              onChange={(e) => { contexts.setActiveId(e.target.value) }}
            >
              {contexts.sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {format(t('contextSessionItem'), { id: s.sessionId.slice(0, 8), n: s.count })}
                </option>
              ))}
            </select>
          </div>
        )}
      {contexts.message ? <ErrorText>{contexts.message}</ErrorText> : null}
      {contexts.activeId !== null
        ? (
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
 * One row: group badge, source badge, announcement switch, and exactly the
 * operations the row's group allows.
 */
function SkillRow({ skill, skills, t }: SkillRowProps) {
  const isBusy = skills.busyPath === skill.path
  const isOpen = skills.detailPath === skill.path
  const redFlag = skill.untracked === true

  return (
    <div>
      <div className={css.row} style={redFlag ? { outline: '1px solid var(--dsh-danger, #d1242f)' } : undefined}>
        <div className={css.main} style={{ cursor: 'pointer' }} onClick={() => { skills.view(skill) }}>
          <div className={css.name}>
            <span className={css.nameText}>
              {skill.name}
              {skill.linked ? '' : t('suffixUnlinked')}
              {redFlag ? t('suffixUntracked') : ''}
            </span>
          </div>
          {skill.description ? <div className={css.desc}>{skill.description}</div> : null}
        </div>
        <Badge>{t(GROUP_KEY[skill.group])}</Badge>
        <Badge>{sourceLabel(skill.source)}</Badge>
        <Switch
          checked={skill.announce}
          disabled={isBusy}
          onChange={() => { skills.toggleAnnounce(skill) }}
          label={skill.announce ? t('announceOn') : t('announceOff')}
        />
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
              {skill.group === 'stored'
                ? (
                  <Button disabled={isBusy} onClick={() => { skills.unmigrate(skill) }}>
                    {t('btnUnmigrate')}
                  </Button>
                )
                : null}
              {skill.group === 'registered'
                ? (
                  <Button disabled={isBusy} onClick={() => { skills.unregister(skill) }}>
                    {t('btnUnregister')}
                  </Button>
                )
                : null}
              {skill.group !== 'native'
                ? (
                  <Button disabled={isBusy} onClick={() => { skills.unlink(skill) }}>
                    {t('btnUnlink')}
                  </Button>
                )
                : null}
              {skill.group === 'stored' && !skill.linked
                ? (
                  <Button disabled={isBusy} onClick={() => { skills.link(skill) }}>
                    {t('btnLink')}
                  </Button>
                )
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
