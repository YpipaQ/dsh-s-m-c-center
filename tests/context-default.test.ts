/**
 * The workspace default selection (`_default`): the panel's 默认配置 row and
 * the engine's inheritance rule. A conversation without a selection file of
 * its own starts with the default picks; one with its own file ignores the
 * default; the index always pins the default row first.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_CONTEXT_ID, listSelections, readSelection, toggleSelection, writeSelection,
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
    expect(readSelection(workspace, 'session-1')).toEqual({
      sessionId: 'session-1', selected: [], updatedAt: '',
    })
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
