// @vitest-environment jsdom
/**
 * Where the sidebar entry lands.
 *
 * The entry is anchored rather than seated — the shell declares no slot above
 * the workspaces region — so the only thing worth pinning is its position in a
 * sidebar the shell owns, and that a second call does not move it. The second
 * half matters: the mount re-asserts placement on every mutation, so a
 * non-idempotent rule would slide the row under the user's cursor.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { placeEntry } from '../src/client/shell/sidebar.ts'

/** Build the shell fixture: a sidebar column holding the brand and New Session. */
function sidebar(options: { newSessionClass?: string; withColumn?: boolean } = {}): {
  column: HTMLElement
  newSession: HTMLButtonElement
} {
  document.body.innerHTML = ''
  const column = document.createElement('div')
  column.className = 'x_sidebarCol_x'
  const brand = document.createElement('button')
  brand.className = 'x_brandRow_x'
  brand.setAttribute('aria-label', '新建会话')
  const newSession = document.createElement('button')
  newSession.className = options.newSessionClass ?? 'x_newSession_x'
  newSession.setAttribute('aria-label', '新建会话')
  column.append(brand, newSession)
  if (options.withColumn !== false) document.body.append(column)
  return { column, newSession }
}

/** The row under test. */
function entry(): HTMLButtonElement {
  const row = document.createElement('button')
  row.setAttribute('data-dsh-s-m-c-entry', '')
  return row
}

afterEach(() => { document.body.innerHTML = '' })

describe('sidebar entry placement', () => {
  it('sits directly after New Session', () => {
    const { newSession } = sidebar()
    const row = entry()

    expect(placeEntry(row)).toBe(true)
    expect(row.previousElementSibling).toBe(newSession)
  })

  it('is idempotent: re-asserting placement does not move a placed row', () => {
    const { newSession } = sidebar()
    const row = entry()

    placeEntry(row)
    const parent = row.parentElement
    expect(placeEntry(row)).toBe(true)
    expect(placeEntry(row)).toBe(true)
    expect(row.parentElement).toBe(parent)
    expect(row.previousElementSibling).toBe(newSession)
    // One row, not one per call.
    expect(parent?.querySelectorAll('[data-dsh-s-m-c-entry]').length).toBe(1)
  })

  it('finds New Session by its label when the class no longer carries the word', () => {
    const { newSession } = sidebar({ newSessionClass: 'x_primaryAction_x' })
    const row = entry()

    expect(placeEntry(row)).toBe(true)
    expect(row.previousElementSibling).toBe(newSession)
  })

  it('never mistakes the brand row for New Session', () => {
    // Brand sorts first and shares the label; only its class excludes it.
    const { newSession } = sidebar({ newSessionClass: 'x_primaryAction_x' })
    const row = entry()

    placeEntry(row)
    expect(row.previousElementSibling).toBe(newSession)
    expect(row.previousElementSibling?.className).not.toContain('brand')
  })

  it('declines when there is no sidebar yet', () => {
    sidebar({ withColumn: false })
    expect(placeEntry(entry())).toBe(false)
  })

  it('declines when the column has no New Session button', () => {
    document.body.innerHTML = '<div class="x_sidebarCol_x"><button class="x_other_x"></button></div>'
    expect(placeEntry(entry())).toBe(false)
  })
})
