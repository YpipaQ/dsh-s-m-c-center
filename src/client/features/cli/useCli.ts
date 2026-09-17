/**
 * CLI tab state: the discovered/registered CLI list, the on-demand probe
 * (existence / version / subcommands) and the registry add/remove flow.
 */
import { useCallback, useMemo, useState } from 'react'
import type { CliRegistryEntry, CliStateDetail, CliSubcommands, CliSummary } from '../../../shared/protocol/index.ts'
import { api } from '../../shared/useApi.ts'
import { useAsyncList } from '../../shared/useAsyncList.ts'
import { errorText, normalizeQuery } from '../../shared/format.ts'
import type { Translate } from '../../shared/locales.ts'

/** Probe result for the currently expanded row. */
export interface CliDetailState {
  name: string
  state?: CliStateDetail
  subcommands?: CliSubcommands
  busy: boolean
  error: string
}

export interface UseCliOptions {
  /** Workspace cwd passed to the Host (skill-embedded CLI discovery). */
  cwd: string
  /** Bumped by the shell to force a refetch across tabs. */
  refreshKey: number
  /** Shell-bound translator, so hook-generated messages are translated too. */
  t: Translate
}

export interface UseCliResult {
  /** True only for the first fetch, when the list has nothing to show yet. */
  loading: boolean
  /** True while any fetch is in flight, background refetches included. */
  refreshing: boolean
  error: string
  /** Filtered entries (query applied). */
  entries: CliSummary[]
  /** Entry count before filtering (drives the empty-state copy). */
  total: number
  reload: () => void

  query: string
  setQuery: (v: string) => void
  message: string

  /** Expanded row probe state, or null when collapsed. */
  detail: CliDetailState | null
  /** Expand (and probe) a row, or collapse it when already expanded. */
  view: (name: string) => void

  toggle: (entry: CliSummary) => void
  remove: (entry: CliSummary) => void

  /** New registry entry being typed. */
  form: { name: string; command: string }
  setForm: (updater: (prev: { name: string; command: string }) => { name: string; command: string }) => void
  addEntry: () => void
}

/** CLI tab controller. */
export function useCli(options: UseCliOptions): UseCliResult {
  const { cwd, refreshKey, t } = options
  const list = useAsyncList<CliSummary>(() => api.listCli(cwd), [cwd, refreshKey])

  const [form, setForm] = useState({ name: '', command: '' })
  const [detail, setDetail] = useState<CliDetailState | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  const probe = useCallback((name: string) => {
    setDetail((prev) => ({ name, busy: true, error: '', ...(prev && prev.name === name ? prev : {}) }))
    api.probeCli(name, cwd).then((r) => {
      setDetail({ name, state: r.state, subcommands: r.subcommands, busy: false, error: '' })
    }).catch((e) => {
      setDetail({ name, busy: false, error: errorText(e) })
    })
  }, [cwd])

  const view = useCallback((name: string) => {
    if (detail && detail.name === name) { setDetail(null); return }
    probe(name)
  }, [detail, probe])

  // The switch answers the click immediately and only the failing case is
  // reconciled: awaiting the round-trip would leave the toggle visibly lagging,
  // and a full list reload would blank the panel (see useAsyncList).
  const toggle = useCallback((entry: CliSummary) => {
    setMessage('')
    const flip = (enabled: boolean) => (items: CliSummary[]) =>
      items.map((it) => (it.name === entry.name ? { ...it, enabled } : it))
    list.setItems(flip(!entry.enabled))
    api.setCliEnabled(entry.name, !entry.enabled).then(() => { list.reload() })
      .catch((e) => { list.setItems(flip(entry.enabled)); setMessage(errorText(e)) })
  }, [list])

  const remove = useCallback((entry: CliSummary) => {
    // Skill-embedded CLI entries are derived from the skill tree, not the
    // registry — they cannot be deleted here.
    if (entry.source !== 'registry') return
    setMessage('')
    api.deleteCli(entry.name).then(() => { list.reload(); setDetail(null) })
      .catch((e) => { setMessage(errorText(e)) })
  }, [list])

  const addEntry = useCallback(() => {
    const name = form.name.trim()
    const command = form.command.trim() || name
    if (!name) { setMessage(t('msgEnterCliName')); return }
    setMessage('')
    api.saveCli({ name, command, enabled: true } as CliRegistryEntry).then(() => {
      setForm({ name: '', command: '' })
      list.reload()
    }).catch((e) => { setMessage(errorText(e)) })
  }, [form, list, t])

  const entries = useMemo(() => {
    const q = normalizeQuery(query)
    return list.items.filter((it) =>
      q === '' || it.name.toLowerCase().includes(q) || (it.skill || '').toLowerCase().includes(q))
  }, [list.items, query])

  return {
    loading: list.loading,
    refreshing: list.refreshing,
    error: list.error,
    entries,
    total: list.items.length,
    reload: list.reload,
    query, setQuery,
    message,
    detail, view,
    toggle, remove,
    form, setForm, addEntry,
  }
}
