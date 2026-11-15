// @vitest-environment jsdom
/**
 * Where the sidebar entry lands, and how big it is.
 *
 * dsh 0.2.2 changed the shape this row has to live in: New Session is no
 * longer a lone button but a `newSessionRow` flex line holding the icon button
 * and its label mask. Anchoring after the button put this row *inside* that
 * line, sharing its width and squeezing New Session to a stub — so the first
 * case here pins the row-level anchor, not just "somewhere near the button".
 *
 * The geometry cases exist because the row is built imperatively: its numbers
 * are inline styles that no stylesheet test would catch. They are the shell's
 * `.panelRow` values, and a drift in any of them is what makes this entry look
 * bolted on next to 插件 / 自动化任务.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSidebarEntry, placeEntry } from '../src/client/shell/sidebar.ts'
import { zh } from '../src/client/shared/locales.ts'
import type { SkillsMcpKey } from '../src/client/shared/locales.ts'

const t = (key: SkillsMcpKey): string => zh[key]

interface Fixture {
  column: HTMLElement
  newSession: HTMLButtonElement
  row: HTMLElement | null
}

/**
 * Build a sidebar fixture.
 * @param options.withRow - wrap New Session in `newSessionRow` (dsh 0.2.2).
 * @param options.newSessionClass - override the class, to exercise the label fallback.
 * @param options.withColumn - omit the column entirely.
 */
function sidebar(options: { withRow?: boolean; newSessionClass?: string; withColumn?: boolean } = {}): Fixture {
  document.body.innerHTML = ''
  const column = document.createElement('div')
  column.className = 'x_sidebarCol_x'
  const brand = document.createElement('button')
  brand.className = 'x_brandRow_x'
  brand.setAttribute('aria-label', '新建会话')
  const newSession = document.createElement('button')
  newSession.className = options.newSessionClass ?? 'x_newSession_x'
  newSession.setAttribute('aria-label', '新建会话')
  let row: HTMLElement | null = null
  if (options.withRow === true) {
    row = document.createElement('div')
    row.className = 'x_newSessionRow_x'
    row.append(newSession)
    column.append(brand, row)
  } else {
    column.append(brand, newSession)
  }
  if (options.withColumn !== false) document.body.append(column)
  return { column, newSession, row }
}

/** A row shaped like the one the plugin builds. */
function entry(): HTMLButtonElement {
  const row = document.createElement('button')
  row.setAttribute('data-dsh-s-m-c-entry', '')
  return row
}

/** Mount through the public path, so the built row can be inspected. */
function mount(): () => void {
  let dispose: (() => void) | undefined
  mountSidebarEntry({
    effect: (run: () => () => void) => { dispose = run(); return dispose },
  }, t)
  return () => { dispose?.() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('sidebar entry placement', () => {
  it('sits directly after New Session in the flat layout', () => {
    const { newSession } = sidebar()
    const row = entry()

    expect(placeEntry(row)).toBe(true)
    expect(row.previousElementSibling).toBe(newSession)
  })

  it('sits after the newSessionRow wrapper in dsh 0.2.2, never inside it', () => {
    const { row, newSession } = sidebar({ withRow: true })
    const e = entry()

    expect(placeEntry(e)).toBe(true)
    // Sibling of the row, inside the column — not a flex child of the row.
    expect(e.previousElementSibling).toBe(row)
    expect(e.parentElement).toBe(row?.parentElement)
    expect(row?.contains(e)).toBe(false)
    // And New Session is untouched: still the row's only child.
    expect(newSession.parentElement).toBe(row)
    expect(row?.childElementCount).toBe(1)
  })

  it('is idempotent: re-asserting placement does not move a placed row', () => {
    const { row } = sidebar({ withRow: true })
    const e = entry()

    placeEntry(e)
    const parent = e.parentElement
    expect(placeEntry(e)).toBe(true)
    expect(placeEntry(e)).toBe(true)
    expect(e.parentElement).toBe(parent)
    expect(e.previousElementSibling).toBe(row)
    expect(parent?.querySelectorAll('[data-dsh-s-m-c-entry]').length).toBe(1)
  })

  it('finds New Session by its label when the class no longer carries the word', () => {
    const { row } = sidebar({ withRow: true, newSessionClass: 'x_primaryAction_x' })
    const e = entry()

    expect(placeEntry(e)).toBe(true)
    expect(e.previousElementSibling).toBe(row)
  })

  it('never mistakes the brand row for New Session', () => {
    const { row } = sidebar({ withRow: true, newSessionClass: 'x_primaryAction_x' })
    const e = entry()

    placeEntry(e)
    expect(e.previousElementSibling).toBe(row)
    expect(e.previousElementSibling?.className).not.toContain('brand')
  })

  it('declines when there is no sidebar yet', () => {
    sidebar({ withRow: true, withColumn: false })
    expect(placeEntry(entry())).toBe(false)
  })

  it('declines when the column has no New Session button', () => {
    document.body.innerHTML = '<div class="x_sidebarCol_x"><button class="x_other_x"></button></div>'
    expect(placeEntry(entry())).toBe(false)
  })
})

describe('sidebar entry geometry', () => {
  it('copies the shell panel row: 32px tall, 22px line, 6px gap, painted inset', () => {
    sidebar({ withRow: true })
    const dispose = mount()
    const row = document.querySelector('[data-dsh-s-m-c-entry]') as HTMLButtonElement | null

    expect(row).not.toBeNull()
    const css = row?.style.cssText ?? ''
    // jsdom normalises the declaration text (space after `:`, `0` -> `0px`),
    // so assert against the normalised form rather than the authored string.
    expect(css).toContain('min-height: 32px')
    expect(css).toContain('line-height: 22px')
    expect(css).toContain('--dsh-sidebar-label-gap,6px')
    expect(css).toContain('--dsh-sidebar-row-padding,12px')
    expect(css).toContain('--dsh-sidebar-paint-inset,3px')
    expect(css).toContain('--dsw-radius-md,8px')
    // Sits inside the column's 8px padding with the same 4px inset as the
    // New Session row above it.
    expect(css).toContain('calc(100% - 8px)')
    expect(css).toContain('margin: 0px 4px')
    dispose()
  })

  it('draws the glyph at the shell regular weight: 1px strokes, 16px box', () => {
    sidebar({ withRow: true })
    const dispose = mount()
    const svg = document.querySelector('[data-dsh-s-m-c-entry] svg')
    const paths = document.querySelectorAll('[data-dsh-s-m-c-entry] svg path')

    expect(svg?.getAttribute('width')).toBe('16')
    expect(paths.length).toBe(2)
    expect(paths[0]?.getAttribute('stroke-width')).toBe('1')
    expect(paths[1]?.getAttribute('stroke-width')).toBe('1')
    dispose()
  })
})
