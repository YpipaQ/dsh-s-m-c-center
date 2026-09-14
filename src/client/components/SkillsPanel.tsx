/**
 * Skills tab view, split into two sub-pages by switch semantics.
 *
 * 「就地管理」 lists skills that are not store-managed (project roots, skills
 * still sitting in the user roots): the switch writes or removes the SKILL.md
 * frontmatter marker, and each row offers 「收容」 to move the skill into the
 * store. 「储存库」 lists store-managed skills: the switch injects or removes a
 * junction, and the import section lives here.
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
  const { scan, store } = skills
  // The two switch semantics are different jobs: frontmatter rewrite in place
  // versus junction management in the store. Keeping them apart is why each
  // row can stay one decision.
  const [sub, setSub] = useState<'inplace' | 'store'>('inplace')
  const isStore = sub === 'store'

  const groups = skills.groups
    .map((g) => ({ ...g, items: g.items.filter((s) => s.managed === isStore) }))
    .filter((g) => g.items.length > 0)
  const subTotal = skills.filtered.filter((s) => s.managed === isStore).length

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

      {sub === 'inplace' ? (
        <div className={css.section}>
          <div className={css.descWrap}>{t('inPlaceNote')}</div>
          <div className={css.inline}>
            <div className={css.hGrow}>{t('skillList')}</div>
            <Button onClick={skills.reload} disabled={skills.refreshing}>{t('refresh')}</Button>
          </div>
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
          {skills.message ? <ErrorText>{skills.message}</ErrorText> : null}
          {skills.error ? <ErrorText>{skills.error}</ErrorText> : null}
          <SkillList skills={skills} groups={groups} subTotal={subTotal} isStore={isStore} onAdopt={skills.adoptOne} t={t} />
        </div>
      ) : (
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

          <div className={css.inline}>
            <div className={css.hGrow}>{t('importSkill')}</div>
            <Button onClick={skills.reload} disabled={skills.refreshing}>{t('refresh')}</Button>
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

          <div className={css.inline}>
            <div className={css.hGrow}>{t('skillList')}</div>
          </div>
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
          {skills.message ? <ErrorText>{skills.message}</ErrorText> : null}
          {skills.error ? <ErrorText>{skills.error}</ErrorText> : null}
          <SkillList skills={skills} groups={groups} subTotal={subTotal} isStore={isStore} t={t} />
        </div>
      )}
    </div>
  )
}

interface SkillListProps {
  skills: UseSkillsResult
  groups: UseSkillsResult['groups']
  subTotal: number
  isStore: boolean
  /** Present on the in-place sub-page: adopts the skill into the store. */
  onAdopt?: (skill: UseSkillsResult['filtered'][number]) => void
  t: Translate
}

/** One sub-page's grouped list, with the shared loading / empty states. */
function SkillList({ skills, groups, subTotal, isStore, onAdopt, t }: SkillListProps) {
  if (skills.loading) return <Loading t={t} />
  if (groups.length === 0) {
    return <EmptyState title={skills.query !== '' ? t('emptySkillMatch') : (isStore ? t('emptyStoreTab') : t('emptySkills'))} />
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.level}>
          <div className={css.groupH}>{group.label} ({group.items.length})</div>
          {group.items.map((skill) => (
            <SkillRow key={skill.path} skill={skill} skills={skills} onAdopt={onAdopt} t={t} />
          ))}
        </div>
      ))}
      {skills.total > subTotal
        ? <div className={css.note}>{t('otherSubpageHint')}</div>
        : null}
    </>
  )
}

interface SkillRowProps {
  skill: UseSkillsResult['filtered'][number]
  skills: UseSkillsResult
  onAdopt?: (skill: SkillRowProps['skill']) => void
  t: Translate
}

/** One row: switch (semantics depend on the sub-page), detail, actions. */
function SkillRow({ skill, skills, onAdopt, t }: SkillRowProps) {
  const isBusy = skills.busyPath === skill.path
  const isOpen = skills.detailPath === skill.path
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
        <Switch
          checked={skill.enabled}
          disabled={isBusy}
          onChange={() => { skills.toggle(skill) }}
          label={skill.enabled ? t('switchEnable') : t('switchDisable')}
        />
        <Button onClick={() => { skills.view(skill) }}>{isOpen ? t('collapse') : t('details')}</Button>
        {onAdopt
          ? (
            <Button disabled={isBusy} onClick={() => { onAdopt(skill) }}>
              {isBusy ? t('adoptBusy') : t('adopt')}
            </Button>
          )
          : null}
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
