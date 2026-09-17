/**
 * Conversation-context state for the default selection: the skills every
 * conversation without its own file inherits.
 *
 * The engine still keeps one selection document per conversation (`contexts/
 * <sessionId>.json`) and the agent still writes its own through the
 * `skill_select` tool — this panel deliberately exposes only the workspace
 * default (`_default`), because that is the only selection a human needs to
 * set by hand. Per-conversation rows are the agent's business.
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
  /** slug → ticked, for the workspace default. */
  checked: Record<string, boolean>
  /** How many the default has ticked (the section counter). */
  defaultCount: number
  /** Rows the checkboxes map over (stored / registered rows carry a slug). */
  candidates: SkillSummary[]
  /** Row busy flag (slug currently being toggled). */
  busySlug: string
  message: string
  reload: () => void
  toggle: (slug: string) => void
}

/** Session id the workspace default selection lives under (host mirror). */
export const DEFAULT_CONTEXT_ID = '_default'

export function useContexts(options: UseContextsOptions): UseContextsResult {
  const { cwd, refreshKey, skills, t } = options

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [defaultCount, setDefaultCount] = useState(0)
  const [busySlug, setBusySlug] = useState('')
  const [message, setMessage] = useState('')

  const reload = useCallback(() => {
    api.getContext(DEFAULT_CONTEXT_ID, cwd).then((body) => {
      const next: Record<string, boolean> = {}
      for (const slug of body.selection.selected) next[slug] = true
      setChecked(next)
      setDefaultCount(body.selection.selected.length)
    }).catch(() => { setChecked({}); setDefaultCount(0) })
  }, [cwd])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is the caller's contract
  useEffect(() => { reload() }, [cwd, refreshKey, reload])

  const toggle = useCallback((slug: string) => {
    setBusySlug(slug)
    setMessage('')
    api.toggleContext(DEFAULT_CONTEXT_ID, slug, cwd).then((body) => {
      const next: Record<string, boolean> = {}
      for (const s of body.selection.selected) next[s] = true
      setChecked(next)
      setDefaultCount(body.selection.selected.length)
      setBusySlug('')
      setMessage(format(t('msgContextApplied'), {
        n: body.selection.selected.length,
        state: body.applied ? t('msgContextLive') : t('msgContextSaved'),
      }))
    }).catch((e) => { setBusySlug(''); setMessage(errorText(e)) })
  }, [cwd, t])

  // Row candidates: rows the engine can resolve into a registration — a
  // registration needs a slug, which only stored / registered rows carry.
  const candidates = useMemo(
    () => skills.filter((s) => s.level === 'user' && typeof s.slug === 'string' && s.slug !== ''),
    [skills],
  )

  return {
    checked,
    defaultCount,
    candidates,
    busySlug,
    message,
    reload,
    toggle,
  }
}
