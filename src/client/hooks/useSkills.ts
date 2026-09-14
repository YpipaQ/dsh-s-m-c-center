/**
 * Skills tab state: the skill list, the detail pane, the scan/import flow and
 * the toolbar filters.
 *
 * The view layer receives ready-to-render values (`filtered`, `groups`) plus
 * the action callbacks; it never touches the API client or the raw fetch shape.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScannedSkill, SkillSummary, StoreStatus } from '../../protocol.ts'
import { api } from './useApi.ts'
import { useAsyncList } from './useAsyncList.ts'
import { errorText, format, normalizeQuery } from '../utils/format.ts'
import type { EnabledFilter } from '../utils/constants.ts'
import type { SkillsMcpKey, Translate } from '../locales.ts'

/** Scan/import sub-panel state. */
export interface ScanState {
  /** Directory being scanned (editable by the user). */
  dir: string
  /** True while scanning or importing. */
  busy: boolean
  /** Discovered candidates. */
  items: ScannedSkill[]
  /** sourcePath → checked. */
  selected: Record<string, boolean>
  /** Failure message ('' when healthy). */
  error: string
  /** Success/info note ('' when none). */
  note: string
}

export interface UseSkillsOptions {
  /** Workspace cwd passed to the Host (project-scoped skill roots). */
  cwd: string
  /** Bumped by the shell to force a refetch across tabs. */
  refreshKey: number
  /** Directory picker exposed by the dsh shell. */
  pickDirectory: () => Promise<string | null>
  /** Shell-bound translator, so hook-generated messages are translated too. */
  t: Translate
}

export interface UseSkillsResult {
  /** Filtered + windowed list state. */
  loading: boolean
  /** True while any list fetch is in flight, background refetches included. */
  refreshing: boolean
  error: string
  /** Rows after the query/enabled filters. */
  filtered: SkillSummary[]
  /** Filtered rows grouped by level, in display order. */
  groups: Array<{ level: string; label: string; items: SkillSummary[] }>
  /** Total rows before filtering (drives the empty copy). */
  total: number
  /** User-level skills still living at their original location (not managed). */
  userUnmanaged: number
  reload: () => void

  // toolbar filters
  query: string
  setQuery: (v: string) => void
  enabledFilter: EnabledFilter
  setEnabledFilter: (v: EnabledFilter) => void

  // row actions
  /** Path currently being mutated (spinner + disable). */
  busyPath: string
  /** Transient action error. */
  message: string
  toggle: (skill: SkillSummary) => void
  /** Adopt an in-place skill into the store (import + enable, junction managed). */
  adoptOne: (skill: SkillSummary) => void
  /** Two-step delete: first call arms the confirm, second executes. */
  remove: (skill: SkillSummary) => void
  /** Path armed for deletion, or null. */
  confirmPath: string | null

  // detail
  detailPath: string | null
  detail: { path: string; data: any } | null
  view: (skill: SkillSummary) => void

  // store
  /** Store state for the migration banner, or null while loading. */
  store: StoreStatus | null

  // scan / import
  scan: ScanState
  setScanDir: (dir: string) => void
  chooseDir: () => void
  doScan: () => void
  toggleSelect: (sourcePath: string) => void
  doImport: () => void
}

/** Group captions as locale keys; the panel resolves them with `t`. */
const LEVEL_ORDER: Array<[string, SkillsMcpKey]> = [['project', 'levelProject'], ['user', 'levelUser']]

/** Skills tab controller. */
export function useSkills(options: UseSkillsOptions): UseSkillsResult {
  const { cwd, refreshKey, pickDirectory, t } = options

  const list = useAsyncList<SkillSummary>(
    () => api.listSkills(cwd),
    [cwd, refreshKey],
  )

  const [query, setQuery] = useState('')
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>('all')
  const [busyPath, setBusyPath] = useState('')
  const [message, setMessage] = useState('')
  const [confirmPath, setConfirmPath] = useState<string | null>(null)
  const [detailPath, setDetailPath] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ path: string; data: any } | null>(null)
  const [store, setStore] = useState<StoreStatus | null>(null)
  const [scan, setScan] = useState<ScanState>({
    dir: '', busy: false, items: [], selected: {}, error: '', note: '',
  })

  // The store banner answers "why is my skill in ~/.dsh/S-M-C/skills now?", so
  // it has to stay in step with the list: both refetch after every mutation.
  const reloadStore = useCallback(() => {
    api.storeStatus().then(setStore).catch(() => { setStore(null) })
  }, [])

  const reloadList = list.reload
  const reloadAll = useCallback(() => {
    reloadList()
    reloadStore()
  }, [reloadList, reloadStore])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is the caller's contract
  useEffect(() => { reloadStore() }, [refreshKey, reloadStore])

  const toggle = useCallback((skill: SkillSummary) => {
    setBusyPath(skill.path)
    setMessage('')
    api.toggleSkill(skill.path, !skill.enabled).then(() => {
      setBusyPath('')
      reloadAll()
    }).catch((e) => { setBusyPath(''); setMessage(errorText(e)) })
  }, [reloadAll])

  const remove = useCallback((skill: SkillSummary) => {
    if (confirmPath !== skill.path) { setConfirmPath(skill.path); return }
    setConfirmPath(null)
    setBusyPath(skill.path)
    setMessage('')
    api.deleteSkill(skill.path, skill.kind).then(() => {
      setBusyPath('')
      reloadAll()
    }).catch((e) => { setBusyPath(''); setMessage(errorText(e)) })
  }, [confirmPath, reloadAll])

  const view = useCallback((skill: SkillSummary) => {
    if (detailPath === skill.path) { setDetailPath(null); setDetail(null); return }
    setDetailPath(skill.path)
    setDetail(null)
    api.readSkill(skill.path).then((data) => {
      setDetail({ path: skill.path, data })
    }).catch((e) => {
      setDetail({ path: skill.path, data: { error: errorText(e) } })
    })
  }, [detailPath])

  const setScanDir = useCallback((dir: string) => {
    setScan((prev) => ({ ...prev, dir, error: '' }))
  }, [])

  const chooseDir = useCallback(() => {
    pickDirectory().then((path) => {
      if (path) setScan((prev) => ({ ...prev, dir: path, error: '' }))
    }).catch((e) => {
      setScan((prev) => ({ ...prev, error: errorText(e) }))
    })
  }, [pickDirectory])

  const doScan = useCallback(() => {
    setScan((prev) => {
      const dir = prev.dir.trim()
      if (!dir) return { ...prev, error: t('msgEnterDir') }
      api.scanSkills(dir).then((items) => {
        setScan((cur) => ({
          ...cur, busy: false, items, selected: {},
          note: items.length === 0 ? t('msgNoImportable') : '',
        }))
      }).catch((e) => {
        setScan((cur) => ({ ...cur, busy: false, items: [], error: errorText(e) }))
      })
      return { ...prev, busy: true, items: [], error: '', note: '' }
    })
  }, [t])

  const toggleSelect = useCallback((sourcePath: string) => {
    setScan((prev) => {
      const selected = { ...prev.selected }
      if (selected[sourcePath]) delete selected[sourcePath]
      else selected[sourcePath] = true
      return { ...prev, selected }
    })
  }, [])

  const doImport = useCallback(() => {
    setScan((prev) => {
      const chosen = prev.items.filter((it) => prev.selected[it.sourcePath])
      if (chosen.length === 0) return { ...prev, error: t('msgSelectFirst') }
      api.importSkills(chosen.map((it) => ({ sourcePath: it.sourcePath, kind: it.kind })))
        .then((results) => {
          const imported = results.filter((x) => x.ok).length
          setScan((cur) => ({ ...cur, busy: false, selected: {}, note: format(t('msgImported'), { n: imported }) }))
          reloadAll()
        }).catch((e) => {
          setScan((cur) => ({ ...cur, busy: false, error: errorText(e) }))
        })
      return { ...prev, busy: true, error: '' }
    })
  }, [reloadAll, t])

  const adoptOne = useCallback((skill: SkillSummary) => {
    setBusyPath(skill.path)
    setMessage('')
    // The API takes the bundle directory for bundles; the list row carries the
    // SKILL.md path, so strip the trailing segment (both separators occur —
    // the host runs on Windows but stores what the OS join produced).
    const sourcePath = skill.kind === 'bundle'
      ? skill.path.replace(/[\\/]+SKILL\.md$/i, '')
      : skill.path
    api.importSkills([{ sourcePath, kind: skill.kind }])
      .then((results) => {
        setBusyPath('')
        const first = results[0]
        setMessage(first?.ok
          ? format(t('msgAdopted'), { name: skill.name })
          : errorText(first?.reason ?? 'adopt failed'))
        reloadAll()
      })
      .catch((e) => { setBusyPath(''); setMessage(errorText(e)) })
  }, [reloadAll, t])

  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    return list.items.filter((it) => {
      if (q !== '' && !it.name.toLowerCase().includes(q)) return false
      if (enabledFilter === 'enabled' && !it.enabled) return false
      if (enabledFilter === 'disabled' && it.enabled) return false
      return true
    })
  }, [list.items, query, enabledFilter])

  const groups = useMemo(() => {
    const byLevel: Record<string, SkillSummary[]> = {}
    for (const it of filtered) (byLevel[it.level] = byLevel[it.level] || []).push(it)
    return LEVEL_ORDER
      .map(([level, label]) => ({ level, label: t(label), items: byLevel[level] || [] }))
      .filter((g) => g.items.length > 0)
  }, [filtered, t])

  // Drives the uninstall page's conditional button: with an empty store but
  // unmanaged user-level skills on disk, "undo migration" becomes "migrate".
  const userUnmanaged = useMemo(
    () => list.items.filter((it) => it.level === 'user' && !it.managed).length,
    [list.items],
  )

  return {
    loading: list.loading,
    refreshing: list.refreshing,
    error: list.error,
    filtered,
    groups,
    total: list.items.length,
    userUnmanaged,
    reload: reloadAll,
    query, setQuery,
    enabledFilter, setEnabledFilter,
    busyPath, message,
    toggle, adoptOne, remove, confirmPath,
    detailPath, detail, view,
    store,
    scan, setScanDir, chooseDir, doScan, toggleSelect, doImport,
  }
}
