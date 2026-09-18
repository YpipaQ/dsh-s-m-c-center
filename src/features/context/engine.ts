/**
 * The conversation context engine — which skills each conversation has enabled.
 *
 * One job: keep the **relay table** (`$STORE_ROOT/contexts.json`, see
 * `./table.ts`) in step with the skills each conversation has chosen.
 * *Applying* that choice to a live agent is a separate concern with its own
 * module (`./apply.ts`), because it needs cordis fiber lifetimes; this file
 * stays pure arithmetic over one document.
 *
 * The write is deliberately split from the decision so a caller can apply a
 * change to a live conversation **first** and only persist once that worked:
 *
 *   planSelection()   read + decide   — writes nothing
 *   commitSelection() persist         — writes the decided row
 *
 * A caller that persists first cannot undo it when the apply fails, which left
 * the UI showing "enabled" for something the agent could not see.
 *
 * Guarantees:
 * - A conversation with no row of its own inherits the default (the panel's
 *   会话默认 card); with no default either it sees no managed skill through this
 *   engine (dsh's own roots keep working as dsh ships them).
 * - **No workspace is involved.** The key is the session id, which is unique on
 *   its own, so two panels asking about the same conversation always read the
 *   same bytes. This is the whole point of the table: the old per-workspace
 *   files made the answer depend on resolving a directory, and two callers
 *   resolved differently.
 * - SKILL.md files are never touched; the choice lives in the table, so two
 *   conversations can hold different selections at once.
 * - The agent toggles through the registered `skill_select` tool, which writes
 *   the same table the panel writes — UI and agent always agree.
 * @module
 */

import { existsSync, readdirSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join, parse as parsePath } from 'node:path'
import { dshHomeDir } from '../../shared/paths.ts'
import {
  applyOverrides, asStringList, asText, contextTablePath, diffAgainst, emptyTable,
  isReservedSessionId, readContextTable, scanReservedSessionKeys, writeContextTable,
} from './table.ts'
import type { ContextOverrides, ContextTable } from './table.ts'

export {
  applyOverrides, contextTablePath, diffAgainst,
} from './table.ts'
export type { ContextOverrides, ContextTable, ContextTableEntry } from './table.ts'

/**
 * Directory name an older version kept per-conversation selections in, inside
 * each workspace. Read only by {@link importLegacyContexts}; nothing writes it
 * any more.
 */
export const CONTEXTS_DIR_NAME = 'contexts'

/**
 * Session id the default selection lives under. A conversation without a row of
 * its own inherits this selection, so the panel's 会话默认 card is "the skills a
 * new conversation starts with". Real dsh session ids never look like this.
 */
export const DEFAULT_CONTEXT_ID = '_default'

/** Per-conversation selection, resolved (not the stored row). */
export interface ContextSelection {
  sessionId: string
  /** The effective slug set — what the engine installs, in pick order. */
  selected: string[]
  updatedAt: string
  /** Conversation rows only: the diff from the default that made `selected`. */
  overrides?: ContextOverrides
  /** Whether the conversation has a row of its own (false = pure default). */
  configured?: boolean
}

/** One row of the panel's conversation index. */
export interface SelectionRow {
  sessionId: string
  count: number
  updatedAt: string
}

/** A table row that is not a conversation selection. */
export interface IgnoredSelection {
  name: string
  /** Why it was skipped. Today a single reason exists; more are expected. */
  reason: 'reserved'
}

/**
 * Read one conversation's selection: the default with the conversation's own
 * diff applied, or the default alone when it has no row.
 *
 * Tolerates a missing or corrupt table — a broken selection must never take
 * down the plugin or a conversation.
 */
export function readSelection(sessionId: string): ContextSelection {
  const table = readContextTable()
  const base = table.default.selected
  if (sessionId === DEFAULT_CONTEXT_ID) {
    return { sessionId, selected: [...base], updatedAt: table.default.updatedAt, configured: true }
  }
  const entry = table.sessions[sessionId]
  if (entry === undefined) {
    // Nothing of its own: the conversation *is* the default, and keeps
    // following it.
    return {
      sessionId, selected: [...base], updatedAt: '', overrides: { on: [], off: [] }, configured: false,
    }
  }
  return {
    sessionId,
    selected: applyOverrides(base, entry),
    updatedAt: entry.updatedAt,
    overrides: { on: [...entry.on], off: [...entry.off] },
    configured: true,
  }
}

/**
 * Write one conversation's selection.
 *
 * Only the fields this version owns reach the file: the default keeps its full
 * `selected`, a conversation keeps its diff. A caller that hands over a whole
 * set without a diff gets one derived here — "this conversation selects exactly
 * these" is then stored as the difference from the default, which is what keeps
 * later default edits reaching the skills it never ruled on. `stamp: false`
 * preserves the stored `updatedAt` for a structural rewrite, which is not a
 * user edit.
 */
export function writeSelection(
  selection: ContextSelection,
  options: { stamp?: boolean } = {},
): void {
  const table = readContextTable()
  const updatedAt = options.stamp === false ? selection.updatedAt : new Date().toISOString()
  if (selection.sessionId === DEFAULT_CONTEXT_ID) {
    table.default = { selected: [...selection.selected], updatedAt }
  } else {
    table.sessions[selection.sessionId] = {
      on: [...(selection.overrides?.on ?? diffAgainst(table.default.selected, selection.selected).on)],
      off: [...(selection.overrides?.off ?? diffAgainst(table.default.selected, selection.selected).off)],
      updatedAt,
    }
  }
  writeContextTable(table)
}

/**
 * The selection that would result from setting one slug on or off, **without
 * writing anything**.
 *
 * A conversation without a row of its own plans from the default, and the
 * result is expressed as a diff against it — so a conversation that only ever
 * turned one skill off keeps following every other default change.
 *
 * @param selected - the desired state. Omit it to flip whatever is there.
 */
export function planSelection(
  sessionId: string,
  slug: string,
  selected?: boolean,
): ContextSelection {
  const current = readSelection(sessionId)
  const picked = current.selected.includes(slug)
  const want = selected ?? !picked
  const next = want === picked
    ? current.selected
    : want ? [...current.selected, slug] : current.selected.filter((s) => s !== slug)
  if (sessionId === DEFAULT_CONTEXT_ID) {
    return { sessionId, selected: next, updatedAt: current.updatedAt, configured: true }
  }
  return {
    sessionId,
    selected: next,
    updatedAt: current.updatedAt,
    overrides: diffAgainst(readContextTable().default.selected, next),
    configured: true,
  }
}

/** Persist a planned selection. The only writer besides {@link writeSelection}. */
export function commitSelection(selection: ContextSelection): void {
  writeSelection(selection)
}

/**
 * Drop a conversation's row, so it follows the default again.
 * @returns the selection it now inherits.
 */
export function resetSelection(sessionId: string): ContextSelection {
  if (sessionId !== DEFAULT_CONTEXT_ID) {
    const table = readContextTable()
    if (table.sessions[sessionId] !== undefined) {
      delete table.sessions[sessionId]
      writeContextTable(table)
    }
  }
  return readSelection(sessionId)
}

/**
 * Plan and persist in one step (the convenience form).
 * Prefer {@link planSelection} + {@link commitSelection} where the caller has a
 * live agent to apply to first.
 */
export function toggleSelection(sessionId: string, slug: string): ContextSelection {
  const next = planSelection(sessionId, slug)
  commitSelection(next)
  return next
}

/**
 * The selection index: the default row first, then every conversation that
 * holds a row (newest first), plus the rows that were skipped.
 *
 * Reserved names are reported rather than silently dropped: a stray `default`
 * row looks like a conversation, and the last time one appeared it was taken
 * for a schema migration. Naming it in `ignored` is what stops that.
 */
export function readContextIndex(): {
  selections: SelectionRow[]
  ignored: IgnoredSelection[]
} {
  const table = readContextTable()
  const base = table.default.selected
  const rows: SelectionRow[] = Object.entries(table.sessions)
    .map(([sessionId, entry]) => ({
      sessionId,
      // The effective set, not the stored diff: the default may have moved
      // since the row was written, and the count has to match what the
      // conversation really installs.
      count: applyOverrides(base, entry).length,
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return {
    selections: [
      { sessionId: DEFAULT_CONTEXT_ID, count: base.length, updatedAt: table.default.updatedAt },
      ...rows,
    ],
    ignored: scanReservedSessionKeys().map((name) => ({ name, reason: 'reserved' as const })),
  }
}

/** The conversation rows plus the default — the index's flat shape. */
export function listSelections(): SelectionRow[] {
  return readContextIndex().selections
}

/** Path of one workspace's legacy selection directory (import only). */
export function legacySelectionDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.dsh', 'S-M-C', CONTEXTS_DIR_NAME)
}

/**
 * Directories that may still hold a pre-table layout, for the one-shot import.
 *
 * Deliberately a short, predictable list rather than a disk walk: the current
 * directory, its project root, its volume root (which is where a workspace
 * without a project marker used to file its state) and the dsh home. Guessing
 * less means the import cannot wander into an unrelated tree.
 */
export function legacyContextCandidates(): string[] {
  const cwd = process.cwd()
  const roots = new Set<string>([cwd, parsePath(cwd).root, dshHomeDir()])
  return [...roots].filter((root) => root !== '' && existsSync(legacySelectionDir(root)))
}

/** What the one-shot import did — reported, never guessed at. */
export interface LegacyImportReport {
  /** Whether the table was created (false when one already existed). */
  ran: boolean
  /** Directories that held a legacy layout. */
  dirs: string[]
  /** Where the imported default came from ('' when none was found). */
  defaultFrom: string
  /** The default it imported. */
  defaultSelected: string[]
  /** Conversation ids imported. */
  sessions: string[]
  /** Files skipped, with why. */
  skipped: string[]
}

/**
 * Fold an older per-workspace layout into the table — **once**.
 *
 * Runs only when the table does not exist yet, so the migration cannot fight
 * with live state: after the first mount the table is the truth and these files
 * are just leftovers. The `default` files of several workspaces collapse into
 * one, so the winner is the most recently written (ties broken by the fuller
 * one) and the choice is reported rather than silently made.
 *
 * Effective selections are preserved: a conversation's stored set becomes a
 * diff against the default that was just imported, so nothing a user had turned
 * on or off changes meaning.
 */
export function importLegacyContexts(
  dirs: string[],
  options: { force?: boolean } = {},
): LegacyImportReport {
  const report: LegacyImportReport = {
    ran: false, dirs: [...dirs], defaultFrom: '', defaultSelected: [], sessions: [], skipped: [],
  }
  if (options.force !== true && existsSync(contextTablePath())) return report

  const found: Array<{
    dir: string
    sessionId: string
    selected: string[]
    overrides?: ContextOverrides
    updatedAt: string
  }> = []

  for (const dir of dirs) {
    const full = legacySelectionDir(dir)
    let names: string[] = []
    try {
      names = readdirSync(full)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const sessionId = name.slice(0, -'.json'.length)
      if (isReservedSessionId(sessionId) && sessionId !== DEFAULT_CONTEXT_ID) {
        report.skipped.push(sessionId)
        continue
      }
      let parsed: { selected?: unknown; overrides?: unknown; updatedAt?: unknown }
      try {
        parsed = JSON.parse(readFileSync(join(full, name), 'utf8')) as typeof parsed
      } catch {
        report.skipped.push(sessionId + '（不可读）')
        continue
      }
      const overrides = parseOverrides(parsed.overrides)
      found.push({
        dir,
        sessionId,
        selected: asStringList(parsed.selected),
        ...(overrides === undefined ? {} : { overrides }),
        updatedAt: asText(parsed.updatedAt),
      })
    }
  }
  if (found.length === 0) return report

  const table: ContextTable = emptyTable()
  const defaults = found
    .filter((item) => item.sessionId === DEFAULT_CONTEXT_ID)
    .sort((a, b) => {
      const byTime = b.updatedAt.localeCompare(a.updatedAt)
      return byTime !== 0 ? byTime : b.selected.length - a.selected.length
    })
  if (defaults[0] !== undefined) {
    table.default = { selected: [...defaults[0].selected], updatedAt: defaults[0].updatedAt }
    report.defaultFrom = defaults[0].dir
    report.defaultSelected = [...defaults[0].selected]
  }

  for (const item of found) {
    if (item.sessionId === DEFAULT_CONTEXT_ID) continue
    const existing = table.sessions[item.sessionId]
    if (existing !== undefined && existing.updatedAt >= item.updatedAt) continue
    const overrides = item.overrides ?? diffAgainst(table.default.selected, item.selected)
    table.sessions[item.sessionId] = {
      on: [...overrides.on], off: [...overrides.off], updatedAt: item.updatedAt,
    }
    report.sessions.push(item.sessionId)
  }

  // Nothing worth keeping → do not create a file for it.
  if (table.default.selected.length === 0 && Object.keys(table.sessions).length === 0) return report
  writeContextTable(table)
  report.ran = true
  return report
}

/** The stored diff, when the document carries one in a readable shape. */
function parseOverrides(raw: unknown): ContextOverrides | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const row = raw as { on?: unknown; off?: unknown }
  return { on: asStringList(row.on), off: asStringList(row.off) }
}
