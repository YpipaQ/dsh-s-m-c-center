/**
 * Conversation-context state for the phase-two block: which conversations
 * hold a selection, and the checkbox mapping for one of them.
 *
 * The dropdown's first entry is the workspace default (`_default`): it edits
 * the selection every conversation without its own file inherits. Per-session
 * entries appear for conversations that already hold a selection file (the
 * agent can flip its own skills through the `skill_select` tool at any time),
 * and the checkboxes map the workspace's skill list against that selection.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SkillSummary } from '../../../shared/protocol/index.ts'
import { api } from '../../shared/useApi.ts'
import { errorText, format } from '../../shared/format.ts'
import type { SkillsMcpKey, Translate } from '../../shared/locales.ts'

export interface UseContextsOptions {
  cwd: string
  /** Bumped by the shell to force a refetch. */
  refreshKey: number
  /** The full skill list (rows to tick), shared with the skills tab. */
  skills: SkillSummary[]
  t: Translate
}

export interface UseContextsResult {
  /** Conversations holding a selection, newest first (default excluded). */
  sessions: Array<{ sessionId: string; count: number; updatedAt: string }>
  /** The session id the default selection lives under (dropdown's first row). */
  defaultId: string
  /** The conversation whose checkboxes are shown, or null. */
  activeId: string | null
  setActiveId: (id: string) => void
  /** slug → selected for the active conversation. */
  checked: Record<string, boolean>
  /** Rows the checkboxes map over (stored / registered rows carry a slug). */
  candidates: SkillSummary[]
  /** Row busy flag (slug currently being toggled). */
  busySlug: string
  message: string
  reload: () => void
  toggle: (slug: string) => void
}

export function useContexts(options: UseContextsOptions): UseContextsResult {
  const { cwd, refreshKey, skills, t } = options

  const [sessions, setSessions] = useState<Array<{ sessionId: string; count: number; updatedAt: string }>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busySlug, setBusySlug] = useState('')
  const [message, setMessage] = useState('')

  const reloadSessions = useCallback(() => {
    api.listContexts(cwd).then((body) => {
      setSessions(body.selections)
      // Land on the default selection first: the page's main job is to set
      // the skills new conversations start with.
      setActiveId((current) => current ?? body.defaultId)
    }).catch(() => { setSessions([]) })
  }, [cwd])

  const reloadActive = useCallback((id: string | null) => {
    if (id === null) { setChecked({}); return }
    api.getContext(id, cwd).then((body) => {
      const next: Record<string, boolean> = {}
      for (const slug of body.selection.selected) next[slug] = true
      setChecked(next)
    }).catch(() => { setChecked({}) })
  }, [cwd])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is the caller's contract
  useEffect(() => { reloadSessions() }, [cwd, refreshKey, reloadSessions])

  useEffect(() => { reloadActive(activeId) }, [activeId, reloadActive])

  const toggle = useCallback((slug: string) => {
    if (activeId === null) return
    setBusySlug(slug)
    setMessage('')
    api.toggleContext(activeId, slug, cwd).then((body) => {
      const next: Record<string, boolean> = {}
      for (const s of body.selection.selected) next[s] = true
      setChecked(next)
      setBusySlug('')
      setMessage(format(t('msgContextApplied'), {
        n: body.selection.selected.length,
        state: body.applied ? t('msgContextLive') : t('msgContextSaved'),
      }))
      reloadSessions()
    }).catch((e) => { setBusySlug(''); setMessage(errorText(e)) })
  }, [activeId, cwd, reloadSessions, t])

  // Row candidates: rows the engine can resolve into a registration — a
  // registration needs a slug, which only stored / registered rows carry.
  const candidates = useMemo(
    () => skills.filter((s) => s.level === 'user' && typeof s.slug === 'string' && s.slug !== ''),
    [skills],
  )

  return {
    sessions,
    defaultId: DEFAULT_CONTEXT_ID,
    activeId,
    setActiveId,
    checked,
    candidates,
    busySlug,
    message,
    reload: reloadSessions,
    toggle,
  }
}

/** Session id the workspace default selection is stored under (host mirror). */
export const DEFAULT_CONTEXT_ID = '_default'
