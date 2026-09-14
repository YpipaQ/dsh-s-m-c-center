/**
 * Skills tab view, split into two sub-pages — one per axis.
 *
 * Both sub-pages list every skill; they differ only in which axis the row's
 * switch drives:
 *
 * - 「就地管理」 is the **1/2 axis**: whether the skill is injected into the
 *   agent context, stored as a SKILL.md frontmatter marker (the upstream
 *   approach). Available whenever the skill is reachable — it is unmanaged (its
 *   file already sits in a scanned root) or the A link exists. When the link is
 *   gone (B), the row is locked to 2 (disabled).
 * - 「储存库」 is the **A/B axis**: whether a link to the canonical copy sits in
 *   the skill root. Turning A on for an unmanaged skill adopts it into the
 *   store first; turning it off (B) removes the link and leaves the copy in the
 *   store.
 *
 * The axes do not conflict — the link decides reachability, the frontmatter
 * decides injection — they only compose: A ∧ 1 injects, A ∧ 2 does not, B is
 * locked to 2.
 *
 * Pure presentation over {@link useSkills}: it owns no state beyond the active
 * sub-page and never calls the API directly.
 */
import { useState } from 'react'
import { Badge, Button, EmptyState, ErrorText, Loading, Switch } from './ui/index.tsx'
import type { UseSkillsResult } from '../hooks/useSkills.ts'
import { format, sourceLabel } from '../utils/format.ts'
import type { Translate } from '../locales.ts'
import css from '../settings-card.module.css'

export interface SkillsPanelProps {
  skills: UseSkillsResult
  t: Translate
}

/** Skills tab. */
export function SkillsPanel({ skills, t }: SkillsPanelProps) {
  const { store } = skills
  const [sub, setSub] = useState<'inplace' | 'store'>('inplace')

  return (
    <div className={css.panel}>
      <div className={css.tabs} role="tablist">
        {(['inplace', 'store'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sub === id}
            className={sub === id ? css.tabActive : css.tab}
            onClick={() => { setSub(id) }}
          >
            {t(id === 'inplace' ? 'skillsTabInPlace' : 'skillsTabStore')}
          </button>
        ))}
      </div>

      {sub === 'inplace'
        ? (
          <div className={css.section}>
            <div className={css.descWrap}>{t('inPlaceNote')}</div>
            <div className={css.inline}>
              <div className={css.hGrow}>{t('skillList')}</div>
              <Button onClick={skills.reload} disabled={skills.refreshing}>{t('refresh')}</Button>
            </div>
            <Toolbar skills={skills} t={t} />
            <Messages skills={skills} />
            <SkillList skills={skills} sub="inplace" t={t} />
          </div>
        )
        : (
          <div className={css.section}>
            {store !== null && store.migrated
              ? (
                <div className={css.storeNote}>
                  <div className={css.noteLines}>
                    <div>{format(t('storeMigrated'), { root: store.root || store.dir })}</div>
                    <div>
                      {format(t('storeCount'), { count: store.count, enabled: store.enabled })}
                      {store.failures.length > 0 ? format(t('storeFailures'), { n: store.failures.length }) : ''}
                    </div>
                  </div>
                </div>
              )
              : null}
            <div className={css.descWrap}>{t('storePageNote')}</div>
            <ImportSection skills={skills} t={t} />
            <div className={css.inline}><div className={css.hGrow}>{t('skillList')}</div></div>
            <Toolbar skills={skills} t={t} />
            <Messages skills={skills} />
            <SkillList skills={skills} sub="store" t={t} />
          </div>
        )}
    </div>
  )
}

/** Search box + enabled filter, shared by both sub-pages. */
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

/** Scan-a-directory import; lives on the store sub-page (importing is adoption). */
function ImportSection({ skills, t }: { skills: UseSkillsResult; t: Translate }) {
  const scan = skills.scan
  return (
    <>
      <div className={css.inline}>
        <div className={css.hGrow}>{t('importSkill')}</div>
      </div>
      <div className={css.inline}>
        <input
          className={css.inputGrow}
          placeholder={t('phImportDir')}
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
                  checked={!!scan.selected[it.sourcePath]}
                  onChange={() => { skills.toggleSelect(it.sourcePath) }}
                />
                <div className={css.main}>
                  <div className={css.name}>
                    <span className={css.nameText}>{it.name}{it.kind === 'bundle' ? t('suffixDir') : t('suffixFile')}</span>
                  </div>
                  {it.description ? <div className={css.desc}>{it.description}</div> : null}
                </div>
              </label>
            ))}
            <Button disabled={scan.busy} onClick={skills.doImport}>
              {format(t('importSelected'), { n: Object.keys(scan.selected).length })}
            </Button>
          </div>
        )
        : null}
      {scan.note ? <div className={css.note}>{scan.note}</div> : null}
    </>
  )
}

interface SkillListProps {
  skills: UseSkillsResult
  sub: 'inplace' | 'store'
  t: Translate
}

/** Grouped list of every skill, with the shared loading / empty states. */
function SkillList({ skills, sub, t }: SkillListProps) {
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
            <SkillRow key={skill.path} skill={skill} skills={skills} sub={sub} t={t} />
          ))}
        </div>
      ))}
    </>
  )
}

interface SkillRowProps {
  skill: UseSkillsResult['filtered'][number]
  skills: UseSkillsResult
  sub: 'inplace' | 'store'
  t: Translate
}

/** One row; the switch drives whichever axis the active sub-page owns. */
function SkillRow({ skill, skills, sub, t }: SkillRowProps) {
  const isBusy = skills.busyPath === skill.path
  const isOpen = skills.detailPath === skill.path
  // B (managed, no link): the file is unreachable, so the 1/2 switch is locked
  // to 2 until the store sub-page restores the link.
  const lockedOff = sub === 'inplace' && skill.managed && !skill.linked

  return (
    <div>
      <div className={css.row}>
        <div className={css.main} style={{ cursor: 'pointer' }} onClick={() => { skills.view(skill) }}>
          <div className={css.name}>
            <span className={css.nameText}>{skill.name}{skill.enabled ? '' : t('suffixNotEnabled')}</span>
          </div>
          {skill.description ? <div className={css.desc}>{skill.description}</div> : null}
        </div>
        <Badge>{sourceLabel(skill.source)}</Badge>
        {sub === 'inplace'
          ? (
            <Switch
              checked={!lockedOff && skill.enabled}
              disabled={isBusy || lockedOff}
              onChange={() => { skills.toggle(skill) }}
              label={lockedOff ? t('switchLocked') : (skill.enabled ? t('switchEnable') : t('switchDisable'))}
            />
          )
          : (
            // Unmanaged skills sit outside this axis entirely: the switch is
            // inert rather than silently adopting a skill into the store.
            <Switch
              checked={skill.managed && skill.linked}
              disabled={isBusy || !skill.managed}
              onChange={() => { skills.toggleLink(skill) }}
              label={!skill.managed ? t('linkNone') : (skill.linked ? t('linkOn') : t('linkOff'))}
            />
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
