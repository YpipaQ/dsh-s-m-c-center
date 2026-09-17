/**
 * Skills tab state: the four-group skill list, the detail pane, the
 * scan/register flow and the toolbar filters.
 *
 * The view layer receives ready-to-render values (`filtered`, `groups`) plus
 * the action callbacks; it never touches the API client or the raw fetch shape.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScannedSkill, SkillGroup, SkillSummary, StoreStatus } from '../../../shared/protocol/index.ts'
import { api } from '../../shared/useApi.ts'
import { useAsyncList } from '../../shared/useAsyncList.ts'
import { errorText, format, normalizeQuery } from '../../shared/format.ts'
import type { EnabledFilter } from '../../shared/constants.ts'
import type { SkillsMcpKey, Translate } from '../../shared/locales.ts'

/** Scan/register sub-panel state. */
export interface ScanState {
  /** Directory being scanned (editable by the user). */
  dir: string
  /** True while scanning or registering. */
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
  /** Rows after the query/announce filters. */
  filtered: SkillSummary[]
  /** Filtered rows grouped by level, in display order. */
  groups: Array<{ level: string; label: string; items: SkillSummary[] }>
  /** Total rows before filtering (drives the empty copy). */
  total: number
  /** User-level native skills still at their original location. */
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
  /** The per-skill announcement flag (公告 / 隐藏). */
  toggleAnnounce: (skill: SkillSummary) => void
  /** Create (or confirm) the link for a stored/registered skill. */
  link: (skill: SkillSummary) => void
  /** Remove the link (the canonical copy is never touched). */
  unlink: (skill: SkillSummary) => void
  /** Native → stored: canonical copy into the store, link back in place. */
  migrate: (skill: SkillSummary) => void
  /** Undo a migration: link + ledger + manifest go, the copy returns home. */
  unmigrate: (skill: SkillSummary) => void
  /** Drop a registry entry (and its link, when one exists). */
  unregister: (skill: SkillSummary) => void
  /** Verify one link; the result lands in `message`. */
  verify: (skill: SkillSummary) => void
  /** Delete an untracked link (one the ledger has no record of). */
  deleteUntracked: (skill: SkillSummary) => void
  /** Traceability pass over the registry; the summary lands in `message`. */
  refreshRegistry: () => void
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

  // scan / register
  scan: ScanState
  setScanDir: (dir: string) => void
  chooseDir: () => void
  doScan: () => void
  toggleSelect: (sourcePath: string) => void
  doRegister: () => void
}

/** Group captions as locale keys; the panel resolves them with `t`. */
const GROUP_ORDER: Array<{ level: string; group?: SkillGroup; label: SkillsMcpKey }> = [
  // The user-level groups split by on-disk identity because their UIs differ:
  // native rows offer 迁移入库, stored rows offer 撤销迁移/联接, registered
  // rows offer 取消登记.
  { level: 'user', group: 'native', label: 'levelUser' },
  { level: 'user', group: 'stored', label: 'levelStore' },
  { level: 'user', group: 'registered', label: 'groupRegistered' },
  { level: 'project', label: 'levelProject' },
]

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

  /** Run one mutation against the API, then refresh list + banner. */
  const act = useCallback((skill: SkillSummary, run: () => Promise<unknown>, done?: (result: unknown) => string | void) => {
    setBusyPath(skill.path)
    setMessage('')
    run().then((result) => {
      setBusyPath('')
      const note = done?.(result)
      if (typeof note === 'string') setMessage(note)
      reloadAll()
    }).catch((e) => { setBusyPath(''); setMessage(errorText(e)) })
  }, [reloadAll])

  const toggleAnnounce = useCallback((skill: SkillSummary) => {
    act(skill, () => api.setSkillAnnounce(skill.group, skill.slug ?? '', !skill.announce))
  }, [act])

  const link = useCallback((skill: SkillSummary) => {
    act(skill, () => api.linkSkill(skill.slug ?? ''))
  }, [act])

  const unlink = useCallback((skill: SkillSummary) => {
    act(skill, () => api.unlinkSkill(skill.slug ?? ''))
  }, [act])

  const migrate = useCallback((skill: SkillSummary) => {
    // The API takes the bundle directory for bundles; the list row carries the
    // SKILL.md path, so strip the trailing segment (both separators occur).
    const sourcePath = skill.kind === 'bundle'
      ? skill.path.replace(/[\\/]+SKILL\.md$/i, '')
      : skill.path
    act(skill, () => api.migrateSkill(sourcePath, skill.kind, skill.source))
  }, [act])

  const unmigrate = useCallback((skill: SkillSummary) => {
    act(skill, () => api.unmigrateSkill(skill.slug ?? ''))
  }, [act])

  const unregister = useCallback((skill: SkillSummary) => {
    act(skill, () => api.unregisterSkill(skill.slug ?? ''))
  }, [act])

  const verify = useCallback((skill: SkillSummary) => {
    const key = skill.slug ?? skill.path
    act(skill, () => api.verifyLink(key), (result) => {
      const v = result as { ok: boolean; reason?: string; tracked?: boolean; target?: string }
      if (!v.ok) return errorText(v.reason ?? 'verify failed')
      return v.tracked
        ? t('msgVerifyTracked') + (v.target ?? '')
        : t('msgVerifyUntracked') + (v.target ?? '')
    })
  }, [act, t])

  const deleteUntracked = useCallback((skill: SkillSummary) => {
    act(skill, () => api.deleteUntrackedLink(skill.path))
  }, [act])

  const refreshRegistry = useCallback(() => {
    setMessage('')
    api.refreshRegistry().then((results) => {
      const missing = results.filter((r) => !r.exists)
      setMessage(missing.length === 0
        ? format(t('msgRefreshOk'), { n: results.length })
        : format(t('msgRefreshMissing'), { n: missing.length }) + ' ' + missing.map((m) => m.name).join(', '))
      reloadAll()
    }).catch((e) => { setMessage(errorText(e)) })
  }, [reloadAll, t])

  const remove = useCallback((skill: SkillSummary) => {
    if (confirmPath !== skill.path) { setConfirmPath(skill.path); return }
    setConfirmPath(null)
    act(skill, () => api.deleteSkill(skill.path, skill.kind))
  }, [act, confirmPath])

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

  const doRegister = useCallback(() => {
    setScan((prev) => {
      const chosen = prev.items.filter((it) => prev.selected[it.sourcePath] && !it.oversize)
      if (chosen.length === 0) return { ...prev, error: t('msgSelectFirst') }
      api.registerSkills(chosen.map((it) => ({ sourcePath: it.sourcePath, kind: it.kind })))
        .then((results) => {
          const registered = results.filter((x) => x.ok).length
          setScan((cur) => ({ ...cur, busy: false, selected: {}, note: format(t('msgRegistered'), { n: registered }) }))
          reloadAll()
        }).catch((e) => {
          setScan((cur) => ({ ...cur, busy: false, error: errorText(e) }))
        })
      return { ...prev, busy: true, error: '' }
    })
  }, [reloadAll, t])

  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    return list.items.filter((it) => {
      if (q !== '' && !it.name.toLowerCase().includes(q)) return false
      if (enabledFilter === 'enabled' && !it.announce) return false
      if (enabledFilter === 'disabled' && it.announce) return false
      return true
    })
  }, [list.items, query, enabledFilter])

  const groups = useMemo(() => {
    return GROUP_ORDER
      .map(({ level, group, label }) => ({
        level,
        label: t(label),
        items: filtered.filter((it) => it.level === level && (group === undefined || it.group === group)),
      }))
      .filter((g) => g.items.length > 0)
  }, [filtered, t])

  // Drives the uninstall page's conditional button: with an empty store but
  // native user-level skills on disk, "undo migration" becomes "migrate".
  const userUnmanaged = useMemo(
    () => list.items.filter((it) => it.level === 'user' && it.group === 'native' as SkillGroup).length,
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
    toggleAnnounce, link, unlink, migrate, unmigrate, unregister,
    verify, deleteUntracked, refreshRegistry,
    remove, confirmPath,
    detailPath, detail, view,
    store,
    scan, setScanDir, chooseDir, doScan, toggleSelect, doRegister,
  }
}
