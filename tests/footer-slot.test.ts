// @vitest-environment jsdom
/**
 * Where our row sits when another plugin shares the sidebar foot.
 *
 * The bug this pins was visible and specific: with one other footer action
 * registered, the two entries shared a single flex line and both rendered as
 * truncated labels — "会…" beside "性能监视器". The shell lays the seat out
 * horizontally and a plugin cannot ask it not to, so the entry folds the line
 * itself (see sidebar-entry.module.css) and this module decides which end of
 * the resulting stack each entry belongs at.
 *
 * The rule is a product decision worth stating plainly, because it is not the
 * obvious one: a *large square tile* beside us takes the bottom (next to
 * Settings) and our row goes above it, while anything lighter — a compact
 * icon, or a row that is merely wide — goes above us instead. The boundary is
 * therefore the thing to test, not the mechanism.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  footerActionOrder, isBigSquareIcon, placeFooterAction,
} from '../src/client/shell/footer-slot.ts'

/** Build the seat the shell renders: a container, the slot wrapper, our row. */
function seat(siblings: readonly { width: number; height: number }[] = []): { slot: HTMLElement; row: HTMLElement } {
  document.body.innerHTML = ''
  const container = document.createElement('div')
  const slot = document.createElement('div')
  slot.setAttribute('data-slot', 'sidebar.footer.action')
  container.append(slot)
  const row = document.createElement('div')
  slot.append(row)
  for (const box of siblings) {
    const other = document.createElement('div')
    // jsdom lays nothing out, so the measurement has to be supplied.
    Object.defineProperty(other, 'getBoundingClientRect', { value: () => ({ width: box.width, height: box.height }) })
    slot.append(other)
  }
  document.body.append(container)
  return { slot, row }
}

beforeEach(() => { document.body.innerHTML = '' })

describe('what counts as a large square tile', () => {
  it('accepts a tile that is big on both sides', () => {
    expect(isBigSquareIcon({ width: 32, height: 32 })).toBe(true)
    expect(isBigSquareIcon({ width: 40, height: 40 })).toBe(true)
  })

  it('accepts a tile whose sides differ by the usual border and padding', () => {
    expect(isBigSquareIcon({ width: 36, height: 46 })).toBe(true)
    expect(isBigSquareIcon({ width: 46, height: 36 })).toBe(true)
  })

  it('rejects a square that is simply small', () => {
    expect(isBigSquareIcon({ width: 24, height: 24 })).toBe(false)
    expect(isBigSquareIcon({ width: 16, height: 16 })).toBe(false)
  })

  it('rejects a row, however tall it is', () => {
    // Our own row is 42px tall and fills the column; height alone must not
    // promote a neighbour to "block".
    expect(isBigSquareIcon({ width: 260, height: 42 })).toBe(false)
  })

  it('rejects an unmeasured or collapsed box', () => {
    expect(isBigSquareIcon({ width: 0, height: 0 })).toBe(false)
    expect(isBigSquareIcon({ width: 0, height: 40 })).toBe(false)
  })
})

describe('which end of the stack we take', () => {
  it('takes the bottom when the neighbour is a large square tile', () => {
    expect(footerActionOrder({ width: 32, height: 32 })).toBe(-1)
  })

  it('takes the bottom when the neighbour is lighter than us', () => {
    expect(footerActionOrder({ width: 16, height: 16 })).toBe(1)
    expect(footerActionOrder({ width: 260, height: 42 })).toBe(1)
  })

  it('has no opinion when we are alone', () => {
    expect(footerActionOrder(undefined)).toBe(0)
  })
})

describe('applying it to a live row', () => {
  it('leaves the order unset when no other action is present', () => {
    const { row } = seat()

    placeFooterAction(row)

    expect(row.style.getPropertyValue('order')).toBe('')
  })

  it('moves above a large square tile', () => {
    const { row } = seat([{ width: 40, height: 40 }])

    placeFooterAction(row)

    expect(row.style.order).toBe('-1')
  })

  it('moves below a small icon', () => {
    const { row } = seat([{ width: 18, height: 18 }])

    placeFooterAction(row)

    expect(row.style.order).toBe('1')
  })

  it('moves below a wide row', () => {
    const { row } = seat([{ width: 260, height: 42 }])

    placeFooterAction(row)

    expect(row.style.order).toBe('1')
  })

  it('forgets the order when the other action goes away', () => {
    const { slot, row } = seat([{ width: 40, height: 40 }])
    placeFooterAction(row)
    expect(row.style.order).toBe('-1')

    slot.removeChild(slot.children[1] as Element)
    placeFooterAction(row)

    expect(row.style.getPropertyValue('order')).toBe('')
  })

  it('reads the first neighbour, so a later one cannot flip the decision', () => {
    const { row } = seat([{ width: 40, height: 40 }, { width: 12, height: 12 }])

    placeFooterAction(row)

    expect(row.style.order).toBe('-1')
  })
})
