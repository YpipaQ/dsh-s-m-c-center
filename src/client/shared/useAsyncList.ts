/**
 * Generic "fetch a list on mount / on dependency change" hook.
 *
 * All three panels previously hand-rolled the same shape: a `{loading, items,
 * error}` record, a `load()` that resets it, and a useEffect keyed on the
 * current cwd plus a refresh counter. This factors that out once.
 *
 * Two loading notions are kept apart on purpose. A refetch that follows a local
 * action (toggling a switch, deleting a row) must not blank the panel: the list
 * stays on screen and is simply replaced once the fresh payload lands. Only the
 * very first fetch — where there is genuinely nothing to show — reports
 * `loading`, so the panels' loading placeholder never appears mid-session.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from './format.ts'

export interface AsyncListState<T> {
  /** True only while the FIRST fetch is in flight (nothing to show yet). */
  loading: boolean
  /** True while any fetch is in flight, background refetches included. */
  refreshing: boolean
  /** Latest payload; kept across refetches so the view never blanks out. */
  items: T[]
  /** Display-ready failure message ('' when healthy). */
  error: string
}

export interface UseAsyncListResult<T> extends AsyncListState<T> {
  /** Re-run the fetch with the current dependencies. */
  reload: () => void
  /**
   * Replace the payload locally (used by optimistic updates). Accepts an
   * updater so a rapid double action never reads a stale list.
   */
  setItems: (next: T[] | ((prev: T[]) => T[])) => void
}

/**
 * Fetch a list whenever a dependency changes (or `reload()` is called).
 *
 * @param fetcher - Returns the list. Must be stable or declared inline; it is
 *   read through a ref so an inline closure does not retrigger the effect.
 * @param deps - Values whose change should refetch (cwd, refresh counter, …).
 */
export function useAsyncList<T>(fetcher: () => Promise<T[]>, deps: readonly unknown[]): UseAsyncListResult<T> {
  const [state, setState] = useState<AsyncListState<T>>({ loading: true, refreshing: true, items: [], error: '' })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(() => {
    // Deliberately keeps `items` and `loading` untouched: a refetch is an
    // in-place update, not a teardown. Only the very first fetch (handled by
    // the initial state above) reports `loading`.
    setState((prev) => ({ ...prev, refreshing: true, error: '' }))
    fetcherRef.current().then((items) => {
      setState({ loading: false, refreshing: false, items, error: '' })
    }).catch((e) => {
      // Keep whatever is on screen: a failed refresh should surface the error
      // line, not wipe the list the user was looking at.
      setState((prev) => ({ loading: false, refreshing: false, items: prev.items, error: errorText(e) }))
    })
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's contract
  useEffect(() => { run() }, deps)

  const setItems = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    setState((prev) => ({
      ...prev,
      items: typeof next === 'function' ? (next as (prev: T[]) => T[])(prev.items) : next,
    }))
  }, [])

  return { ...state, reload: run, setItems }
}
