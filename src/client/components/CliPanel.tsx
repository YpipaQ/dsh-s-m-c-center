/**
 * CLI tab view. Presentation over {@link useCli}; the probe result pane is
 * folded in as a small local sub-component since it is only used here.
 */
import { Badge, Button, EmptyState, ErrorText, Loading, StateRow, Switch } from './ui/index.tsx'
import type { CliDetailState, UseCliResult } from '../hooks/useCli.ts'
import { cliAnnounceLabel } from '../utils/constants.ts'
import { format } from '../utils/format.ts'
import type { Translate } from '../locales.ts'
import css from '../settings-card.module.css'

export interface CliPanelProps {
  cli: UseCliResult
  /** The unified store root, so the copy quotes the real registry path. */
  root?: string
  t: Translate
}

/** CLI tab. */
export function CliPanel({ cli, root, t }: CliPanelProps) {
  const store = root || '~/.dsh/S-M-C'
  return (
    <div className={css.panel}>
      <div className={css.section}>
        <div className={css.inline}>
          <div className={css.hGrow}>{t('panelCli')}</div>
          <input
            className={css.inputGrow}
            placeholder={t('phSearchCli')}
            value={cli.query}
            onChange={(e) => { cli.setQuery(e.target.value) }}
          />
          <Button onClick={cli.reload} disabled={cli.refreshing}>{t('refresh')}</Button>
        </div>
        <div className={css.descWrap} style={{ marginTop: 0 }}>
          {format(t('cliIntro'), { store })}
        </div>
        <div className={css.descWrap}>{t('cliSkillHint')}</div>
        {cli.message ? <ErrorText>{cli.message}</ErrorText> : null}
        {cli.error ? <ErrorText>{cli.error}</ErrorText> : null}
        {cli.loading
          ? <Loading t={t} />
          : cli.entries.length === 0
            ? <EmptyState title={cli.total === 0 ? t('emptyCli') : t('emptyCliMatch')} />
            : cli.entries.map((entry) => {
                const isOpen = cli.detail !== null && cli.detail.name === entry.name
                const isRegistry = entry.source === 'registry'
                return (
                  <div key={entry.name}>
                    <div className={css.row}>
                      <div className={css.main} style={{ cursor: 'pointer' }} onClick={() => { cli.view(entry.name) }}>
                        <div className={css.name}>
                          <span className={css.nameText}>{entry.name}{entry.enabled ? '' : t('suffixHidden')}</span>
                          <span className={css.status}>{entry.exists ? t('stInstalled') : t('stNotFound')}</span>
                        </div>
                        <div className={css.desc}>
                          {t(entry.source === 'skill' ? 'cliSkillSource' : 'sourceSystem')} · {entry.path || entry.command}
                        </div>
                      </div>
                      {/* Every row gets the switch: for a skill-provided CLI it is
                          written as a same-named registry entry on first flip. */}
                      <Switch
                        checked={entry.enabled}
                        onChange={() => { cli.toggle(entry) }}
                        label={t(cliAnnounceLabel(entry.enabled))}
                      />
                      <Button onClick={() => { cli.view(entry.name) }}>{isOpen ? t('collapse') : t('probe')}</Button>
                      {isRegistry
                        ? (
                          <Button variant="danger" onClick={() => { cli.remove(entry) }}>
                            {cli.confirmName === entry.name ? t('confirmDelete') : t('delete')}
                          </Button>
                        )
                        : null}
                    </div>
                    {isOpen && cli.detail ? <CliDetailPane detail={cli.detail} t={t} /> : null}
                  </div>
                )
              })}
      </div>

      <div className={css.section}>
        <div className={css.h}>{t('registerCli')}</div>
        <div className={css.inline}>
          <input
            className={css.inputGrow}
            placeholder={t('phCliName')}
            value={cli.form.name}
            onChange={(e) => { cli.setForm((prev) => ({ ...prev, name: e.target.value })) }}
          />
          <input
            className={css.inputGrow}
            placeholder={t('phCliCall')}
            value={cli.form.command}
            onChange={(e) => { cli.setForm((prev) => ({ ...prev, command: e.target.value })) }}
          />
          <Button variant="primary" onClick={cli.addEntry}>{t('add')}</Button>
        </div>
        <div className={css.descWrap}>
          {t('cliRegisterNote')}
        </div>
      </div>
    </div>
  )
}

interface CliDetailPaneProps {
  detail: CliDetailState
  t: Translate
}

/** Expanded probe result for one CLI row. */
function CliDetailPane({ detail, t }: CliDetailPaneProps) {
  if (detail.busy) return <div className={css.detail}><div>{t('probing')}</div></div>
  if (detail.error) return <div className={css.detail}><div>{detail.error}</div></div>
  const { state, subcommands } = detail
  return (
    <div className={css.detail}>
      <div>
        <StateRow label={t('rowExists')} value={state?.exists === false ? t('stNotFound') : t('stInstalled')} />
        <StateRow label={t('rowPath')} value={state?.path} />
        <StateRow label={t('rowVersion')} value={state?.version} />
        <StateRow
          label={t('rowNeedUpdate')}
          value={state?.needUpdate === true ? t('yesUpdateRecommended') : state?.needUpdate === false ? t('no') : undefined}
        />
        <StateRow
          label={t('rowApiKey')}
          value={state?.apiKey?.status
            ? (state.apiKey.status === 'configured' ? t('configured') : state.apiKey.status)
            : undefined}
        />
        {state?.apiKey?.error ? <StateRow label={t('rowKeyError')} value={state.apiKey.error} /> : null}
        {subcommands && subcommands.subcommands.length > 0
          ? (
            <div className={css.inline} style={{ flexWrap: 'wrap', gap: 6 }}>
              {subcommands.subcommands.map((c) => <Badge key={c}>{c}</Badge>)}
            </div>
          )
          : null}
      </div>
    </div>
  )
}
