/**
 * Own-settings state: this plugin's `dsh-s-m-c-center` namespace block in
 * ~/.dsh/settings.yaml.
 *
 * The write path is optimistic-free on purpose: the Host round-trips the
 * persisted record, and the Host side re-applies the system-prompt
 * announcement synchronously, so the returned value is the new truth.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ManagerSettings } from '../../shared/protocol/index.ts'
import { api } from './useApi.ts'
import { errorText } from './format.ts'

/** Field-level state for the settings block. */
export interface ManagerSettingsState {
  /** True until the first read settles. */
  loading: boolean
  /** Persisted record, or null before the first successful read. */
  value: ManagerSettings | null
  /** Display-ready failure message ('' when healthy). */
  error: string
  /** True while a save is in flight. */
  saving: boolean
}

export interface UseManagerSettingsResult extends ManagerSettingsState {
  /** Flip announceToAgent and persist. No-op while loading/saving. */
  toggleAnnounce: () => void
}

/** Read + persist the plugin's own settings block. */
export function useManagerSettings(): UseManagerSettingsResult {
  const [state, setState] = useState<ManagerSettingsState>({
    loading: true, value: null, error: '', saving: false,
  })

  useEffect(() => {
    let alive = true
    api.getSettings().then((value) => {
      if (alive) setState((prev) => ({ ...prev, loading: false, value }))
    }).catch((e) => {
      if (alive) setState((prev) => ({ ...prev, loading: false, error: errorText(e) }))
    })
    return () => { alive = false }
  }, [])

  const { value, saving } = state
  const toggleAnnounce = useCallback(() => {
    if (!value || saving) return
    setState((prev) => ({ ...prev, saving: true, error: '' }))
    api.saveSettings({ announceToAgent: !value.announceToAgent }).then((next) => {
      setState({ loading: false, value: next, error: '', saving: false })
    }).catch((e) => {
      setState((prev) => ({ ...prev, saving: false, error: errorText(e) }))
    })
  }, [value, saving])

  return { ...state, toggleAnnounce }
}
