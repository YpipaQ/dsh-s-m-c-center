/**
 * Conversation-context state for the session default: the skills every
 * conversation without a row of its own inherits.
 *
 * All of it lives in **one relay table on the host** (`$STORE_ROOT/
 * contexts.json`, keyed by session id), which is why this hook takes no cwd:
 * the settings page and the sidebar read the same document, so one switch can
 * no longer show two answers. The panel exposes the default alone — a
 * conversation's own selection is the agent's business.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SkillSummary } from '../../../shared/protocol/index.ts'
import { api } from '../../shared/useApi.ts'
import { errorText, format } from '../../shared/format.ts'
import type { Translate } from '../../shared/locales.ts'

export interface UseContextsOptions {
  /** Bumped by the shell to force a refetch. */
  refreshKey: number
  /** The full skill list (rows to tick), shared with the skills tab. */
  skills: SkillSummary[]
  t: Translate
}

export interface UseContextsResult {
  /** slug → ticked, for the session default. */
  checked: Record<string, boolean>
  /** How many the default has ticked (the section counter). */
  defaultCount: number
  /** Rows the switches map over (stored / registered rows carry a slug). */
  candidates: SkillSummary[]
  /** Row busy flag (slug currently being toggled). */
  busySlug: string
  message: string
  /** Where the state lives — shown in the card so it is findable. */
  tablePath: string
  reload: () => void
  toggle: (slug: string) => void
}

/** Session id the session default lives under (host mirror). */
export const DEFAULT_CONTEXT_ID = '_default'

export function useContexts(options: UseContextsOptions): UseContextsResult {
  const { refreshKey, skills, t } = options

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [defaultCount, setDefaultCount] = useState(0)
  const [busySlug, setBusySlug] = useState('')
  const [message, setMessage] = useState('')
  const [tablePath, setTablePath] = useState('')

  const adopt = useCallback((selected: string[], table: string) => {
    const next: Record<string, boolean> = {}
    for (const slug of selected) next[slug] = true
    setChecked(next)
    setDefaultCount(selected.length)
    setTablePath(table)
  }, [])

  const reload = useCallback(() => {
    api.getContext(DEFAULT_CONTEXT_ID)
      .then((body) => { adopt(body.selection.selected, body.table) })
      .catch(() => { setChecked({}); setDefaultCount(0) })
  }, [adopt])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is the caller's contract
  useEffect(() => { reload() }, [refreshKey, reload])

  const toggle = useCallback((slug: string) => {
    setBusySlug(slug)
    setMessage('')
    api.toggleContext(DEFAULT_CONTEXT_ID, slug).then((body) => {
      adopt(body.selection.selected, body.table)
      setBusySlug('')
      setMessage(format(t('msgContextApplied'), {
        n: body.selection.selected.length,
        state: body.applied ? t('msgContextLive') : t('msgContextSaved'),
      }))
    }).catch((e) => { setBusySlug(''); setMessage(errorText(e)) })
  }, [adopt, t])

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
    tablePath,
    reload,
    toggle,
  }
}
