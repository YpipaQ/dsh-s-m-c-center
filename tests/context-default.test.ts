/**
 * The session-skill relay table: the default a conversation inherits, the diff
 * a conversation stores, and the one-shot import of the older layout.
 *
 * This replaced one JSON file per workspace. That layout made the answer to
 * "what has this conversation enabled" depend on resolving a workspace first,
 * and two callers resolved differently — the settings page used the workspace
 * dsh reports for the page, the sidebar the one the conversation runs in. Same
 * switch, two files, two answers. Keying on the session id removes the
 * resolution step, so these tests assert the property that matters: one
 * conversation, one set, whichever panel asks.
 *
 * The diff rule is the other half: a conversation row stores only how it
 * differs from the default, because storing the whole set froze the default of
 * that moment into the conversation on its first flip and no later edit could
 * turn those skills off again.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  DEFAULT_CONTEXT_ID, commitSelection, contextTablePath, importLegacyContexts, legacySelectionDir,
  listSelections, planSelection, readContextIndex, readSelection, resetSelection, toggleSelection,
  writeSelection,
} from '../src/features/context/index.ts'

let home: string
let origHome: string | undefined

// The table lives under $DSH_HOME, so every test owns a home of its own —
// otherwise it would edit the real machine's selections.
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'smc-contexts-'))
  origHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  rmSync(home, { recursive: true, force: true })
})

interface RawTable {
  default: { selected: string[]; updatedAt: string }
  sessions: Record<string, unknown>
}

/**
 * The table as it sits on disk.
 *
 * A missing file reads as an empty table: plenty of the behaviour under test is
 * 'this call writes nothing', and after one of those the file legitimately does
 * not exist yet.
 */
function onDisk(): RawTable {
  if (!existsSync(contextTablePath())) return { default: { selected: [], updatedAt: '' }, sessions: {} }
  return JSON.parse(readFileSync(contextTablePath(), 'utf8')) as RawTable
}

/** Write the table document raw — for shapes this code would not produce. */
function putOnDisk(body: unknown): void {
  mkdirSync(dirname(contextTablePath()), { recursive: true })
  writeFileSync(contextTablePath(), JSON.stringify(body, null, 2), 'utf8')
}

/** A legacy workspace-shaped directory holding selection files. */
function legacyDir(name: string, files: Record<string, unknown>): string {
  const dir = join(home, name)
  const full = legacySelectionDir(dir)
  mkdirSync(full, { recursive: true })
  for (const [sessionId, body] of Object.entries(files)) {
    writeFileSync(join(full, sessionId + '.json'), JSON.stringify(body, null, 2), 'utf8')
  }
  return dir
}

/** Set the default, preserving the stamp so ordering tests stay deterministic. */
function setDefault(selected: string[], updatedAt = ''): void {
  writeSelection({ sessionId: DEFAULT_CONTEXT_ID, selected, updatedAt }, { stamp: false })
}

describe('the session default (_default)', () => {
  it('a conversation with no row of its own is the default', () => {
    setDefault(['gsap', 'pptx-author'])
    const inherited = readSelection('session-1')
    expect(inherited.selected).toEqual(['gsap', 'pptx-author'])
    expect(inherited.configured).toBe(false)
  })

  it('a conversation with a row ignores the part of the default it ruled out', () => {
    setDefault(['gsap'])
    writeSelection({ sessionId: 'session-1', selected: ['audit-xl'], updatedAt: '' })
    expect(readSelection('session-1').selected).toEqual(['audit-xl'])
    // …and the row is stored as a diff, not a copy of the whole set.
    expect(onDisk().sessions['session-1']).toMatchObject({ on: ['audit-xl'], off: ['gsap'] })
  })

  it('an empty world selects nothing, and the default itself is readable', () => {
    expect(readSelection('session-1')).toEqual({
      sessionId: 'session-1', selected: [], updatedAt: '', overrides: { on: [], off: [] }, configured: false,
    })
    setDefault(['gsap'])
    expect(readSelection(DEFAULT_CONTEXT_ID).selected).toEqual(['gsap'])
  })

  it('toggleSelection flips one slug and persists it', () => {
    setDefault(['gsap'])
    const next = toggleSelection('session-1', 'audit-xl')
    expect(next.selected).toEqual(['gsap', 'audit-xl'])
    const after = toggleSelection('session-1', 'gsap')
    expect(after.selected).toEqual(['audit-xl'])
  })
})

describe('planSelection — decide without writing', () => {
  it('the requested state decides, and flipping is only the default', () => {
    writeSelection({ sessionId: 'session-1', selected: ['gsap'], updatedAt: '' })
    expect(planSelection('session-1', 'gsap', true).selected).toEqual(['gsap'])
    expect(planSelection('session-1', 'gsap', false).selected).toEqual([])
    expect(planSelection('session-1', 'other', true).selected).toEqual(['gsap', 'other'])
    // Omitted → flip.
    expect(planSelection('session-1', 'gsap').selected).toEqual([])
  })

  it('writes nothing — only commitSelection persists', () => {
    planSelection('session-1', 'gsap', true)
    expect(onDisk().sessions).toEqual({})
  })

  it('plans from the inherited default, so the first flip does not drop it', () => {
    setDefault(['gsap'])
    expect(planSelection('session-1', 'audit-xl', true).selected).toEqual(['gsap', 'audit-xl'])
  })
})

describe('readContextIndex — reserved rows are reported, not listed', () => {
  it('pins the default first and nothing else when there is nothing else', () => {
    expect(listSelections()).toEqual([{ sessionId: DEFAULT_CONTEXT_ID, count: 0, updatedAt: '' }])
  })

  it('lists the default first, then conversations newest-first, by effective count', () => {
    setDefault(['gsap'], '2026-01-01T00:00:00Z')
    writeSelection({ sessionId: 'old', selected: ['gsap', 'a'], updatedAt: '2026-01-02T00:00:00Z' }, { stamp: false })
    writeSelection({ sessionId: 'new', selected: ['gsap', 'b', 'c'], updatedAt: '2026-01-03T00:00:00Z' }, { stamp: false })

    const rows = listSelections()

    expect(rows.map((r) => r.sessionId)).toEqual([DEFAULT_CONTEXT_ID, 'new', 'old'])
    expect(rows.map((r) => r.count)).toEqual([1, 3, 2])
  })

  it('reports a row named after the default instead of reading it as a conversation', () => {
    setDefault(['gsap'])
    writeSelection({ sessionId: 'session-1', selected: ['gsap', 'a'], updatedAt: '' })
    // A row this code would never write: it comes from a caller that sent the
    // reserved id, and the last time one appeared it was taken for a migration.
    const raw = onDisk()
    raw.sessions.default = { on: [], off: [], updatedAt: '' }
    putOnDisk(raw)

    const index = readContextIndex()

    expect(index.selections.map((r) => r.sessionId)).toEqual([DEFAULT_CONTEXT_ID, 'session-1'])
    expect(index.ignored).toEqual([{ name: 'default', reason: 'reserved' }])
  })

  it('replaces an unreadable document with an empty one rather than throwing', () => {
    putOnDisk({ nonsense: true })
    expect(readSelection('session-1').selected).toEqual([])
    expect(listSelections()).toEqual([{ sessionId: DEFAULT_CONTEXT_ID, count: 0, updatedAt: '' }])
  })
})

/**
 * What a conversation row is allowed to remember.
 *
 * It stores the **diff** from the default, never a pinned copy of it. Storing
 * the whole set is what made "改默认关不掉技能" possible: the first flip in a
 * conversation froze the default of that moment into it, so a later edit to the
 * default reached only conversations that had never been touched. The diff is
 * also what makes a conversation's own intent survive: a skill it turned off
 * stays off while everything else keeps following the default.
 */
describe('a conversation row stores a diff, not a pinned set', () => {
  it('a conversation that never configured itself follows later default edits', () => {
    setDefault(['gsap'])
    expect(readSelection('session-1').selected).toEqual(['gsap'])

    setDefault(['gsap', 'audit-xl'])

    expect(readSelection('session-1').selected).toEqual(['gsap', 'audit-xl'])
  })

  it('turning one skill off does not freeze the rest of the default', () => {
    setDefault(['a', 'b', 'c'])
    const planned = planSelection('session-1', 'b', false)
    expect(planned.selected).toEqual(['a', 'c'])
    expect(planned.overrides).toEqual({ on: [], off: ['b'] })
    commitSelection(planned)

    // The default gains `d` and drops `c`: `d` arrives, `c` leaves, `b` stays off.
    setDefault(['a', 'b', 'd'])

    expect(readSelection('session-1').selected).toEqual(['a', 'd'])
  })

  it('a skill the default does not have stays after the default empties', () => {
    setDefault(['a'])
    commitSelection(planSelection('session-1', 'z', true))

    setDefault([])

    expect(readSelection('session-1').selected).toEqual(['z'])
  })

  it('resetSelection drops the row, so the conversation follows the default again', () => {
    setDefault(['a'])
    commitSelection(planSelection('session-1', 'z', true))
    expect(readSelection('session-1').selected).toEqual(['a', 'z'])

    const after = resetSelection('session-1')

    expect(after.selected).toEqual(['a'])
    expect(after.configured).toBe(false)
    expect(onDisk().sessions).toEqual({})
  })
})

/**
 * The one-shot import of the old layout.
 *
 * An older version kept one file per conversation inside each workspace. Those
 * files still exist on machines that ran it, and the conversations they describe
 * must not lose their choices — nor keep the workspace dependency. So the import
 * runs once (only while the table does not exist), rewrites what it finds as
 * diffs against the imported default, and reports the choices it had to make.
 */
describe('importLegacyContexts', () => {
  it('folds per-workspace files in, preserving every effective set', () => {
    const older = legacyDir('proj-old', {
      _default: { sessionId: DEFAULT_CONTEXT_ID, selected: ['a', 'b'], updatedAt: '2026-01-01T00:00:00Z' },
      'session-1': { sessionId: 'session-1', selected: ['a'], updatedAt: '2026-01-02T00:00:00Z' },
    })
    const newer = legacyDir('proj-new', {
      _default: { sessionId: DEFAULT_CONTEXT_ID, selected: ['a', 'b', 'c'], updatedAt: '2026-02-01T00:00:00Z' },
      'session-2': { sessionId: 'session-2', selected: ['c'], updatedAt: '2026-02-02T00:00:00Z' },
    })

    const report = importLegacyContexts([older, newer])

    expect(report.ran).toBe(true)
    // Several defaults collapse into one; the newest wins, and the choice is
    // reported rather than silently made.
    expect(report.defaultFrom).toBe(newer)
    expect(report.defaultSelected).toEqual(['a', 'b', 'c'])
    expect(readSelection(DEFAULT_CONTEXT_ID).selected).toEqual(['a', 'b', 'c'])
    // Effective sets are unchanged: session-1 had only `a`, and still does.
    expect([...report.sessions].sort()).toEqual(['session-1', 'session-2'])
    expect(readSelection('session-1').selected).toEqual(['a'])
    expect(readSelection('session-2').selected).toEqual(['c'])
    // …and they are now diffs, so a later default edit reaches them.
    setDefault([])
    expect(readSelection('session-1').selected).toEqual([])
  })

  it('runs once: an existing table is left alone', () => {
    setDefault(['keep'])
    const dir = legacyDir('proj', {
      _default: { sessionId: DEFAULT_CONTEXT_ID, selected: ['other'], updatedAt: '2030-01-01T00:00:00Z' },
    })

    const report = importLegacyContexts([dir])

    expect(report.ran).toBe(false)
    expect(readSelection(DEFAULT_CONTEXT_ID).selected).toEqual(['keep'])
  })

  it('reports the files it skipped rather than dropping them silently', () => {
    const dir = legacyDir('proj', {
      _default: { sessionId: DEFAULT_CONTEXT_ID, selected: ['a'], updatedAt: '2026-01-01T00:00:00Z' },
      default: { sessionId: 'default', selected: ['x'], updatedAt: '' },
    })

    const report = importLegacyContexts([dir])

    expect(report.skipped).toEqual(['default'])
    expect(readSelection(DEFAULT_CONTEXT_ID).selected).toEqual(['a'])
  })

  it('does nothing at all when no directory holds the old layout', () => {
    const report = importLegacyContexts([join(home, 'does-not-exist')])
    expect(report.ran).toBe(false)
    expect(report.sessions).toEqual([])
  })
})
