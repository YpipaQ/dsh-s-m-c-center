/**
 * MCP tab view, split into two sub-pages.
 *
 * 「管理」 is the list: one switch per row (激活 / 归档) plus delete — editing an
 * existing definition is deliberately not offered yet, so the row stays a
 * single decision. 「新建」 is the form / JSON editor that creates a definition.
 *
 * Presentation over {@link UseMcp}: the editor's mode toggle and the connect
 * test both live in the hook, so this file stays declarative.
 */
import { useState } from 'react'
import { Badge, Button, EmptyState, ErrorText, Field, Loading, Switch } from '../../shared/ui.tsx'
import type { UseMcpResult } from './useMcp.ts'
import { MCP_STATUS_LABEL, mcpActiveLabel } from '../../shared/constants.ts'
import type { Translate } from '../../shared/locales.ts'
import css from '../../shared/settings-card.module.css'

export interface McpPanelProps {
  mcp: UseMcpResult
  t: Translate
}

/** MCP tab. */
export function McpPanel({ mcp, t }: McpPanelProps) {
  const { form, patchForm } = mcp
  // Managing the list and creating a definition are different jobs; keeping
  // them apart is why the list can stay one switch per row.
  const [sub, setSub] = useState<'manage' | 'create'>('manage')

  return (
    <div className={css.panel}>
      <div className={css.tabs} role="tablist">
        {(['manage', 'create'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sub === id}
            className={sub === id ? css.tabActive : css.tab}
            onClick={() => { setSub(id) }}
          >
            {t(id === 'manage' ? 'mcpTabManage' : 'mcpTabCreate')}
          </button>
        ))}
      </div>

      {sub === 'manage'
        ? (
          <div className={css.section}>
            <div className={css.inline}>
              <div className={css.hGrow}>{t('panelMcp')}</div>
              <input
                className={css.inputGrow}
                placeholder={t('phSearchServer')}
                value={mcp.query}
                onChange={(e) => { mcp.setQuery(e.target.value) }}
              />
              <Button onClick={mcp.reload} disabled={mcp.refreshing}>{t('refresh')}</Button>
            </div>
            {mcp.message ? <ErrorText>{mcp.message}</ErrorText> : null}
            {mcp.error ? <ErrorText>{mcp.error}</ErrorText> : null}
            {mcp.loading
              ? <Loading t={t} />
              : mcp.servers.length === 0
                ? <EmptyState title={mcp.total === 0 ? t('emptyMcp') : t('emptyMcpMatch')} />
                : mcp.servers.map((s) => {
                    // An unknown runtime status falls back to the raw id rather
                    // than to a translated placeholder key that does not exist.
                    const statusKey = MCP_STATUS_LABEL[s.status]
                    return (
                      <div key={s.name} className={css.row}>
                        <div className={css.main}>
                          <div className={css.name}>
                            <span className={css.nameText}>{s.name}{s.archived ? t('suffixArchived') : ''}</span>
                            <span className={css.status}>{s.archived ? t('stNotConnected') : (statusKey ? t(statusKey) : s.status)}</span>
                            {s.archived ? <Badge>{t('badgeArchive')}</Badge> : <Badge>{t('badgeActive')}</Badge>}
                          </div>
                          <div className={css.desc}>
                            {s.transport}{s.transport === 'stdio' ? ' · ' + (s.command || '') : ' · ' + (s.url || '')}
                          </div>
                          {s.error ? <ErrorText>{s.error}</ErrorText> : null}
                        </div>
                        <Switch
                          checked={s.enabled}
                          onChange={() => { mcp.toggle(s) }}
                          label={t(mcpActiveLabel(s.enabled))}
                        />
                        <Button variant="danger" onClick={() => { mcp.remove(s) }}>
                          {mcp.confirmName === s.name ? t('confirmDelete') : t('delete')}
                        </Button>
                      </div>
                    )
                  })}
          </div>
        )
        : (
          <div className={css.section}>
            <div className={css.h}>{t('newServer')}</div>
            <div className={css.inline}>
              <Button variant={form.mode === 'form' ? 'active' : 'default'} onClick={() => { patchForm({ mode: 'form' }) }}>
                {t('modeForm')}
              </Button>
              <Button variant={form.mode === 'json' ? 'active' : 'default'} onClick={() => { patchForm({ mode: 'json' }) }}>
                {t('modeJson')}
              </Button>
            </div>
            <div className={css.form}>
              {form.mode === 'form'
                ? (
                  <>
                    <Field label={t('fieldName')}>
                      <input className={css.input} value={form.name} placeholder={t('phServerName')} onChange={(e) => { patchForm({ name: e.target.value }) }} />
                    </Field>
                    <Field label={t('fieldTransport')}>
                      <select className={css.input} value={form.transport} onChange={(e) => { patchForm({ transport: e.target.value as 'stdio' | 'streamable-http' }) }}>
                        <option value="stdio">stdio</option>
                        <option value="streamable-http">streamable-http</option>
                      </select>
                    </Field>
                    {form.transport === 'stdio'
                      ? (
                        <>
                          <Field label={t('fieldCommand')}>
                            <input className={css.input} value={form.command} placeholder="npx" onChange={(e) => { patchForm({ command: e.target.value }) }} />
                          </Field>
                          <Field label={t('fieldArgs')}>
                            <textarea className={css.input} rows={2} value={form.args} placeholder={'-y\n@modelcontextprotocol/server-github'} onChange={(e) => { patchForm({ args: e.target.value }) }} />
                          </Field>
                          <Field label={t('fieldEnv')}>
                            <textarea className={css.input} rows={2} value={form.env} onChange={(e) => { patchForm({ env: e.target.value }) }} />
                          </Field>
                          <Field label={t('fieldCwd')}>
                            <input className={css.input} value={form.cwd} onChange={(e) => { patchForm({ cwd: e.target.value }) }} />
                          </Field>
                        </>
                      )
                      : (
                        <>
                          <Field label={t('fieldUrl')}>
                            <input className={css.input} value={form.url} placeholder="http://localhost:3000/mcp" onChange={(e) => { patchForm({ url: e.target.value }) }} />
                          </Field>
                          <Field label={t('fieldHeaders')}>
                            <textarea className={css.input} rows={2} value={form.headers} onChange={(e) => { patchForm({ headers: e.target.value }) }} />
                          </Field>
                        </>
                      )}
                    <div className={css.inline}>
                      {/* Saving lands back on the list, where the new row (or the
                          failure reason) is what the user wants to see next. */}
                      <Button
                        variant="primary"
                        disabled={mcp.busy === 'save'}
                        onClick={() => { mcp.save(); setSub('manage') }}
                      >
                        {mcp.busy === 'save' ? t('saving') : t('save')}
                      </Button>
                      <Button disabled={mcp.busy === 'test'} onClick={mcp.test}>
                        {mcp.busy === 'test' ? t('testing') : t('testConnect')}
                      </Button>
                    </div>
                  </>
                )
                : (
                  <>
                    <textarea
                      className={css.inputMono}
                      rows={12}
                      value={form.json}
                      placeholder={'{\n  "name": "github",\n  "transport": "stdio",\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-github"],\n  "enabled": true\n}'}
                      onChange={(e) => { patchForm({ json: e.target.value }) }}
                    />
                    <Button
                      variant="primary"
                      disabled={mcp.busy === 'save'}
                      onClick={() => { mcp.save(); setSub('manage') }}
                    >
                      {mcp.busy === 'save' ? t('saving') : t('save')}
                    </Button>
                  </>
                )}
            </div>
          </div>
        )}
    </div>
  )
}
