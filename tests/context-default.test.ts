/**
 * The workspace default selection (`_default`): the panel's 默认配置 row and
 * the engine's inheritance rule. A conversation without a selection file of
 * its own starts with the default picks; one with its own file ignores the
 * default; the index always pins the default row first.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONTEXT_ID, commitSelection, listSelections, normaliseSelection, planSelection,
  readContextIndex, readSelection, resetSelection, toggleSelection, writeSelection,
} from '../src/features/context/index.ts'

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'smc-contexts-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('workspace default selection (_default)', () => {
  it('a conversation without its own file inherits the default selection', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap', 'pptx-author'], updatedAt: '' })
    const inherited = readSelection(workspace, 'session-1')
    expect(inherited.sessionId).toBe('session-1')
    expect(inherited.selected).toEqual(['gsap', 'pptx-author'])
  })

  it('a conversation with its own file ignores the default', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    writeSelection(workspace, { sessionId: 'session-1', selected: ['audit-xl'], updatedAt: '' })
    expect(readSelection(workspace, 'session-1').selected).toEqual(['audit-xl'])
  })

  it('no default file and no session file means an empty selection', () => {
    const selection = readSelection(workspace, 'session-1')
    expect(selection.selected).toEqual([])
    expect(selection.configured).toBe(false)
  })

  it('reading the default row reads the default file itself', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    expect(readSelection(workspace, DEFAULT_CONTEXT_ID).selected).toEqual(['gsap'])
  })

  it('toggling a fileless session seeds its own file from the default', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    const next = toggleSelection(workspace, 'session-1', 'audit-xl')
    expect(next.selected).toEqual(['gsap', 'audit-xl'])
    // The session file now exists, so the default no longer leaks in: removing
    // one of the inherited picks keeps the other without re-reading default.
    const after = toggleSelection(workspace, 'session-1', 'gsap')
    expect(after.selected).toEqual(['audit-xl'])
  })

  it('listSelections pins the default row first even with no files at all', () => {
    expect(listSelections(workspace)).toEqual([
      { sessionId: DEFAULT_CONTEXT_ID, count: 0, updatedAt: '' },
    ])
  })

  it('listSelections lists the default first, then sessions newest-first', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '2026-01-01T00:00:00Z' })
    writeSelection(workspace, { sessionId: 'old', selected: ['a'], updatedAt: '2026-01-02T00:00:00Z' })
    writeSelection(workspace, { sessionId: 'new', selected: ['b', 'c'], updatedAt: '2026-01-03T00:00:00Z' })
    const rows = listSelections(workspace)
    expect(rows.map((r) => r.sessionId)).toEqual([DEFAULT_CONTEXT_ID, 'new', 'old'])
    expect(rows[0].count).toBe(1)
  })
})

describe('planSelection — decide without writing', () => {
  it('honours an explicit selected flag instead of flipping blind', () => {
    writeSelection(workspace, { sessionId: 'session-1', selected: ['gsap'], updatedAt: '' })

    // Already selected, asked for true: unchanged. A blind toggle would have
    // *disabled* it while the caller reported "已启用".
    expect(planSelection(workspace, 'session-1', 'gsap', true).selected).toEqual(['gsap'])
    expect(planSelection(workspace, 'session-1', 'gsap', false).selected).toEqual([])
    expect(planSelection(workspace, 'session-1', 'other', true).selected).toEqual(['gsap', 'other'])
    // Omitting the flag keeps the old flip behaviour.
    expect(planSelection(workspace, 'session-1', 'gsap').selected).toEqual([])
  })

  it('writes nothing — only commitSelection persists', () => {
    planSelection(workspace, 'session-1', 'gsap', true)
    expect(existsSync(join(workspace, '.dsh', 'S-M-C', 'contexts', 'session-1.json'))).toBe(false)
  })

  it('seeds a fileless conversation from the default', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    expect(planSelection(workspace, 'session-1', 'audit-xl', true).selected).toEqual(['gsap', 'audit-xl'])
  })
})

describe('readContextIndex — reserved names are reported, not listed', () => {
  it('skips a stray default.json and says why', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    writeSelection(workspace, { sessionId: 'default', selected: [], updatedAt: '' })
    writeSelection(workspace, { sessionId: 'session-1', selected: ['a'], updatedAt: '' })

    const index = readContextIndex(workspace)

    expect(index.selections.map((r) => r.sessionId)).toEqual([DEFAULT_CONTEXT_ID, 'session-1'])
    expect(index.ignored).toEqual([{ name: 'default', reason: 'reserved' }])
  })
})

/**
 * What a conversation file is allowed to remember.
 *
 * It stores the **diff** from the default, never a pinned copy of it. Storing
 * the whole set is what made "改默认关不掉技能" possible: the first flip in a
 * conversation froze the default of that moment into it, so a later edit to the
 * default reached only conversations that had never been touched. The diff is
 * also what makes a conversation's own intent survive: a skill it turned off
 * stays off while everything else keeps following the default.
 */
describe('a conversation file stores a diff, not a pinned set', () => {
  it('a conversation that never configured itself follows later default edits', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap'], updatedAt: '' })
    expect(readSelection(workspace, 'session-1').selected).toEqual(['gsap'])

    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['gsap', 'audit-xl'], updatedAt: '' })

    expect(readSelection(workspace, 'session-1').selected).toEqual(['gsap', 'audit-xl'])
  })

  it('turning one skill off does not freeze the rest of the default', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['a', 'b', 'c'], updatedAt: '' })
    const planned = planSelection(workspace, 'session-1', 'b', false)
    expect(planned.selected).toEqual(['a', 'c'])
    expect(planned.overrides).toEqual({ on: [], off: ['b'] })
    commitSelection(workspace, planned)

    // The default gains `d` and drops `c`: `d` arrives, `c` leaves, `b` stays off.
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['a', 'b', 'd'], updatedAt: '' })

    expect(readSelection(workspace, 'session-1').selected).toEqual(['a', 'd'])
  })

  it('a skill the default does not have stays after the default empties', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['a'], updatedAt: '' })
    commitSelection(workspace, planSelection(workspace, 'session-1', 'z', true))

    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: [], updatedAt: '' })

    expect(readSelection(workspace, 'session-1').selected).toEqual(['z'])
  })

  it('normaliseSelection rewrites a pinned file as a diff, once', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['a', 'b'], updatedAt: '' })
    // What an older version wrote: the whole set and no diff. Written raw,
    // because the current writer would never produce this shape.
    const file = join(workspace, '.dsh', 'S-M-C', 'contexts', 'session-1.json')
    writeFileSync(file, JSON.stringify({
      sessionId: 'session-1', selected: ['a', 'b'], updatedAt: '2026-01-01T00:00:00Z',
    }, null, 2), 'utf8')
    expect(JSON.parse(readFileSync(file, 'utf8')).overrides).toBeUndefined()
    // Read as a diff against the current default: the same set, for now.
    expect(readSelection(workspace, 'session-1').selected).toEqual(['a', 'b'])

    expect(normaliseSelection(workspace, 'session-1')).toBe(true)

    const written = JSON.parse(readFileSync(file, 'utf8'))
    expect(written.overrides).toEqual({ on: [], off: [] })
    expect(written.selected).toEqual(['a', 'b'])
    // Idempotent, and a structural rewrite must not masquerade as a user edit.
    expect(normaliseSelection(workspace, 'session-1')).toBe(false)
    expect(written.updatedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('resetSelection drops the file, so the conversation follows the default again', () => {
    writeSelection(workspace, { sessionId: DEFAULT_CONTEXT_ID, selected: ['a'], updatedAt: '' })
    commitSelection(workspace, planSelection(workspace, 'session-1', 'z', true))
    expect(readSelection(workspace, 'session-1').selected).toEqual(['a', 'z'])

    const after = resetSelection(workspace, 'session-1')

    expect(after.selected).toEqual(['a'])
    expect(after.configured).toBe(false)
    expect(existsSync(join(workspace, '.dsh', 'S-M-C', 'contexts', 'session-1.json'))).toBe(false)
  })
})
