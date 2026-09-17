/**
 * MCP tab state: the server list, the create/edit editor (form + JSON modes)
 * and the connect-test action.
 */
import { useCallback, useMemo, useState } from 'react'
import type { McpServerConfig, McpServerSummary } from '../../../shared/protocol/index.ts'
import { api } from '../../shared/useApi.ts'
import { useAsyncList } from '../../shared/useAsyncList.ts'
import { errorText, format, kvText, normalizeQuery, parseKv } from '../../shared/format.ts'
import { emptyMcpForm, type McpForm } from '../../shared/constants.ts'
import type { Translate } from '../../shared/locales.ts'

export interface UseMcpOptions {
  /** Bumped by the shell to force a refetch across tabs. */
  refreshKey: number
  /** Shell-bound translator, so hook-generated messages are translated too. */
  t: Translate
}

export interface UseMcpResult {
  /** True only for the first fetch, when the list has nothing to show yet. */
  loading: boolean
  /** True while any fetch is in flight, background refetches included. */
  refreshing: boolean
  error: string
  /** Filtered servers (query applied). */
  servers: McpServerSummary[]
  /** Server count before filtering (drives the empty-state copy). */
  total: number
  reload: () => void

  /** Server-name search box. */
  query: string
  setQuery: (v: string) => void

  /** Transient action message (success or failure). */
  message: string

  /** Editor state. */
  form: McpForm
  patchForm: (p: Partial<McpForm>) => void
  /** '' | 'save' | 'test' while an action is in flight. */
  busy: string

  save: () => void
  test: () => void
  toggle: (s: McpServerSummary) => void
  remove: (s: McpServerSummary) => void
  edit: (s: McpServerSummary) => void
}

/** MCP tab controller. */
export function useMcp(options: UseMcpOptions): UseMcpResult {
  const { refreshKey, t } = options
  const list = useAsyncList<McpServerSummary>(() => api.listMcp(), [refreshKey])

  const [form, setForm] = useState<McpForm>(emptyMcpForm)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  const patchForm = useCallback((p: Partial<McpForm>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  // Build the payload from whichever editor mode is active. Returns null (and
  // surfaces the JSON parse error) when the input is unusable.
  const buildServer = useCallback((): McpServerConfig | null => {
    if (form.mode === 'json') {
      try { return JSON.parse(form.json) as McpServerConfig }
      catch (e) { setMessage(format(t('msgJsonFailed'), { error: errorText(e) })); return null }
    }
    const server: McpServerConfig = { name: form.name.trim(), transport: form.transport, enabled: true }
    if (form.transport === 'stdio') {
      server.command = form.command.trim()
      server.args = form.args.split(/\n/).map((l) => l.trim()).filter((l) => l !== '')
      server.cwd = form.cwd.trim()
      server.env = parseKv(form.env)
    } else {
      server.url = form.url.trim()
      server.headers = parseKv(form.headers)
    }
    return server
  }, [form, t])

  const save = useCallback(() => {
    const server = buildServer()
    if (!server) return
    setBusy('save')
    setMessage('')
    api.saveMcp(server).then(() => {
      setBusy('')
      setMessage(format(t('msgSaved'), { name: server.name }))
      setForm(emptyMcpForm())
      list.reload()
    }).catch((e) => { setBusy(''); setMessage(errorText(e)) })
  }, [buildServer, list, t])

  const test = useCallback(() => {
    const server = buildServer()
    if (!server) return
    setBusy('test')
    setMessage('')
    api.testMcp(server).then((r) => {
      setBusy('')
      setMessage(r.ok ? t('msgConnectOk') : format(t('msgConnectFailed'), { error: r.error || 'unknown error' }))
    }).catch((e) => { setBusy(''); setMessage(errorText(e)) })
  }, [buildServer, t])

  // Archive / activate: an archived row has enabled=false, so flipping it
  // moves the definition back into the active document; the reverse moves a
  // live definition out to ~/.dsh/S-M-C/mcp-archive.json.
  //
  // Optimistic like the CLI switch: the row answers the click at once and is
  // reconciled only if the request fails.
  const toggle = useCallback((s: McpServerSummary) => {
    const next = !s.enabled
    setMessage('')
    const flip = (enabled: boolean) => (items: McpServerSummary[]) =>
      items.map((it) => (it.name === s.name ? { ...it, enabled } : it))
    list.setItems(flip(next))
    api.setMcpEnabled(s.name, next).then(() => {
      setMessage(format(next ? t('msgActivated') : t('msgArchived'), { name: s.name }))
      list.reload()
    }).catch((e) => { list.setItems(flip(s.enabled)); setMessage(errorText(e)) })
  }, [list, t])

  const remove = useCallback((s: McpServerSummary) => {
    setMessage('')
    api.deleteMcp(s.name).then(() => { list.reload() }).catch((e) => { setMessage(errorText(e)) })
  }, [list])

  const edit = useCallback((s: McpServerSummary) => {
    setForm({
      name: s.name, transport: s.transport || 'stdio', command: s.command || '',
      args: (s.args || []).join('\n'), env: kvText(s.env), cwd: s.cwd || '',
      url: s.url || '', headers: kvText(s.headers), mode: 'form', json: JSON.stringify(s, null, 2),
    })
  }, [])

  const servers = useMemo(() => {
    const q = normalizeQuery(query)
    return list.items.filter((s) => q === '' || s.name.toLowerCase().includes(q))
  }, [list.items, query])

  return {
    loading: list.loading,
    refreshing: list.refreshing,
    error: list.error,
    servers,
    total: list.items.length,
    reload: list.reload,
    query, setQuery,
    message,
    form, patchForm, busy,
    save, test, toggle, remove, edit,
  }
}
