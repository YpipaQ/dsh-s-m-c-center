/**
 * The conversation window's change detector.
 *
 * The window polls once a second, so the fingerprint is what stands between
 * "the list is up to date" and "the list is torn down and rebuilt every second
 * while the user is reading it". Two properties have to hold, and both are
 * easy to lose by accident:
 *
 *  - **Nothing that is not a change may move it.** The Host rebuilds its array
 *    from a directory scan, so an equal list in a different order is the normal
 *    case, not an edge case. If ordering leaked into the print, the window
 *    would redraw on a schedule it does not control.
 *  - **Everything that is a change must move it.** The fingerprint is the *only*
 *    reason the body redraws, so a field that is drawn but not printed becomes a
 *    row that can never update.
 */
import { describe, expect, it } from 'vitest'
import { fingerprintOf, sortedRows, type PanelView } from '../src/client/shell/panel-state.ts'

/** A view with everything at a known value, so each case moves one field. */
function view(over: Partial<PanelView> = {}): PanelView {
  return {
    sessionId: 'abcdef1234567890',
    title: 'A conversation',
    rows: [
      { slug: 'beta', name: 'Beta', description: 'second' },
      { slug: 'alpha', name: 'Alpha', description: 'first' },
    ],
    selected: ['beta', 'alpha'],
    configured: false,
    table: '/home/u/.dsh/S-M-C/contexts.json',
    error: null,
    ...over,
  }
}

describe('conversation window fingerprint', () => {
  it('is equal for the same view', () => {
    expect(fingerprintOf(view())).toBe(fingerprintOf(view()))
  })

  it('ignores the order rows arrive in', () => {
    const reversed = view({
      rows: [
        { slug: 'alpha', name: 'Alpha', description: 'first' },
        { slug: 'beta', name: 'Beta', description: 'second' },
      ],
    })

    expect(fingerprintOf(reversed)).toBe(fingerprintOf(view()))
  })

  it('ignores the order the selection arrives in', () => {
    expect(fingerprintOf(view({ selected: ['alpha', 'beta'] }))).toBe(fingerprintOf(view()))
  })

  it('moves when the conversation changes', () => {
    expect(fingerprintOf(view({ sessionId: 'ffffffff' }))).not.toBe(fingerprintOf(view()))
  })

  it('moves when the title changes', () => {
    expect(fingerprintOf(view({ title: 'Renamed' }))).not.toBe(fingerprintOf(view()))
  })

  it('moves when a skill is renamed', () => {
    const renamed = view({ rows: [{ slug: 'alpha', name: 'Alpha 2', description: 'first' }] })
    expect(fingerprintOf(renamed)).not.toBe(fingerprintOf(view({ rows: [renamed.rows[0]!, view().rows[0]!] })))
  })

  it('moves when a description changes', () => {
    const edited = view({
      rows: [
        { slug: 'alpha', name: 'Alpha', description: 'rewritten' },
        view().rows[0]!,
      ],
    })

    expect(fingerprintOf(edited)).not.toBe(fingerprintOf(view()))
  })

  it('moves when a skill is added or removed', () => {
    expect(fingerprintOf(view({ rows: [view().rows[0]!] }))).not.toBe(fingerprintOf(view()))
  })

  it('moves when the selection changes', () => {
    expect(fingerprintOf(view({ selected: ['alpha'] }))).not.toBe(fingerprintOf(view()))
  })

  it('moves when this conversation gains or loses its own configuration', () => {
    expect(fingerprintOf(view({ configured: true }))).not.toBe(fingerprintOf(view()))
  })

  it('moves when the relay table path changes', () => {
    expect(fingerprintOf(view({ table: '' }))).not.toBe(fingerprintOf(view()))
  })

  it('moves on a new error, but not on the same error twice', () => {
    const failed = view({ error: 'HTTP 500' })

    expect(fingerprintOf(failed)).not.toBe(fingerprintOf(view()))
    // A round that keeps failing must not rewrite the body every second.
    expect(fingerprintOf(failed)).toBe(fingerprintOf(view({ error: 'HTTP 500' })))
  })
})

describe('sortedRows', () => {
  it('sorts by slug ascending', () => {
    expect(sortedRows(view().rows).map((r) => r.slug)).toEqual(['alpha', 'beta'])
  })

  it('leaves the input array untouched', () => {
    const rows = view().rows
    const before = rows.map((r) => r.slug)

    sortedRows(rows)

    expect(rows.map((r) => r.slug)).toEqual(before)
  })
})
