export interface AsyncListState<T> {
    /** True only while the FIRST fetch is in flight (nothing to show yet). */
    loading: boolean;
    /** True while any fetch is in flight, background refetches included. */
    refreshing: boolean;
    /** Latest payload; kept across refetches so the view never blanks out. */
    items: T[];
    /** Display-ready failure message ('' when healthy). */
    error: string;
}
export interface UseAsyncListResult<T> extends AsyncListState<T> {
    /** Re-run the fetch with the current dependencies. */
    reload: () => void;
    /**
     * Replace the payload locally (used by optimistic updates). Accepts an
     * updater so a rapid double action never reads a stale list.
     */
    setItems: (next: T[] | ((prev: T[]) => T[])) => void;
}
/**
 * Fetch a list whenever a dependency changes (or `reload()` is called).
 *
 * @param fetcher - Returns the list. Must be stable or declared inline; it is
 *   read through a ref so an inline closure does not retrigger the effect.
 * @param deps - Values whose change should refetch (cwd, refresh counter, …).
 */
export declare function useAsyncList<T>(fetcher: () => Promise<T[]>, deps: readonly unknown[]): UseAsyncListResult<T>;
//# sourceMappingURL=useAsyncList.d.ts.map