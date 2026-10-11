/**
 * The floating conversation-skills window's change detector.
 *
 * The window polls the Host once a second, so "did anything change?" has to be
 * a cheap, *total* function of everything the body draws — otherwise every tick
 * would tear the list down and rebuild it, dropping focus and flickering while
 * the user is reading it.
 *
 * Kept free of DOM on purpose (it imports nothing, touches no globals) so the
 * interesting half of the window is unit-testable in the default node
 * environment, where there is no `document` to stand up.
 * @module
 */

/** One selectable skill, exactly the fields the window draws. */
export interface PanelSkillRow {
  name: string
  slug: string
  description: string
}

/** Everything the window renders, folded into one value. */
export interface PanelView {
  /** The conversation the window is about, or undefined for a blank one. */
  sessionId: string | undefined
  /** Its title, read from `document.title`. */
  title: string
  rows: readonly PanelSkillRow[]
  selected: readonly string[]
  /** Whether this conversation carries a selection of its own. */
  configured: boolean
  /** The relay table's path, as the Host reports it. */
  table: string
  /** The failure message when the round trip failed; the body shows it instead. */
  error: string | null
}

/**
 * Rows in a stable order, keyed by slug — ascending, without mutating the input.
 *
 * Both the fingerprint and the render go through this, so "the set we compare"
 * and "the set we draw" are the same list in the same order. The Host rebuilds
 * its array from a directory scan, and a reordered list is not a change.
 * @param rows - the rows to normalise.
 * @returns a new, sorted array.
 */
export function sortedRows(rows: readonly PanelSkillRow[]): PanelSkillRow[] {
  return [...rows].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
}

/**
 * A string that changes exactly when the window's content does.
 *
 * Serialised as an array rather than an object: `JSON.stringify` fixes the
 * order of array elements by construction, so no property-ordering question can
 * leak into the comparison. Ordering that carries no meaning (the row list, the
 * selection) is normalised away first — a reordered array is not a change.
 *
 * `level` / `linked` / `kind` / `path` are deliberately absent: the caller
 * filters on them, so they are constants by the time a view reaches here and
 * would only make the print move when nothing visible did.
 * @param view - the normalised view.
 * @returns the fingerprint.
 */
export function fingerprintOf(view: PanelView): string {
  return JSON.stringify([
    view.sessionId ?? '',
    view.title,
    view.configured,
    view.table,
    view.error,
    sortedRows(view.rows).map((row) => [row.slug, row.name, row.description]),
    [...view.selected].sort(),
  ])
}
