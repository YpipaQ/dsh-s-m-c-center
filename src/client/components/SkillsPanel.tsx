/**
 * Skills tab view. Pure presentation over {@link useSkills}: it owns no state
 * beyond what the hook exposes and never calls the API directly.
 */
import { Badge, Button, Collapsible, EmptyState, ErrorText, Loading, Switch } from './ui/index.tsx'
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
  return (
    <div className={css.panel}>
      {store !== null && store.migrated
        ? (
          <div className={css.storeNote}>
            <div className={css.noteLines}>
              <div>{format(t('storeMigrated'), { root: store.root || store.dir })}</div>
              <div>
                {format(t('storeCount'), { count: store.count, enabled: store.enabled })}
                {store.failures.length > 0 ? format(t('storeFailures'), { n: store.failures.length }) : ''}
              </div>
              <Collapsible label={t('storeMigratedTitle')} expandLabel={t('expand')} collapseLabel={t('collapse')}>
                <div>{t('storeMigratedNote')}</div>
              </Collapsible>
            </div>
          </div>
        )
        : null}
      <div className={css.section}>
        <div className={css.h}>{t('importSkill')}</div>
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
      </div>

      <div className={css.section}>
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
        {skills.loading
          ? <Loading t={t} />
          : skills.filtered.length === 0
            ? <EmptyState title={skills.total === 0 ? t('emptySkills') : t('emptySkillMatch')} />
            : skills.groups.map((group) => (
                <div key={group.level}>
                  <div className={css.groupH}>{group.label} ({group.items.length})</div>
                  {group.items.map((skill) => {
                    const isBusy = skills.busyPath === skill.path
                    const isOpen = skills.detailPath === skill.path
                    return (
                      <div key={skill.path}>
                        <div className={css.row}>
                          <div className={css.main} style={{ cursor: 'pointer' }} onClick={() => { skills.view(skill) }}>
                            <div className={css.name}>
                              <span className={css.nameText}>{skill.name}{skill.enabled ? '' : t('suffixNotEnabled')}</span>
                            </div>
                            {skill.description ? <div className={css.desc}>{skill.description}</div> : null}
                          </div>
                          <Badge>{sourceLabel(skill.source)}</Badge>
                          <Badge>{skill.managed ? t('badgeStore') : t('badgeInPlace')}</Badge>
                          <Switch
                            checked={skill.enabled}
                            disabled={isBusy}
                            onChange={() => { skills.toggle(skill) }}
                            label={skill.enabled ? t('switchEnable') : t('switchDisable')}
                          />
                          <Button onClick={() => { skills.view(skill) }}>{isOpen ? t('collapse') : t('details')}</Button>
                          <Button variant="danger" disabled={isBusy} onClick={() => { skills.remove(skill) }}>
                            {skills.confirmPath === skill.path ? t('confirmDelete') : t('delete')}
                          </Button>
                        </div>
                        {isOpen ? <SkillDetail detail={skills.detail} path={skill.path} fallback={skill.description} t={t} /> : null}
                      </div>
                    )
                  })}
                </div>
              ))}
      </div>
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
