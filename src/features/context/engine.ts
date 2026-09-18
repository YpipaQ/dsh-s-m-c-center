/**
 * The conversation context engine — the per-conversation selection layer.
 *
 * One job: keep `<workspace>/.dsh/S-M-C/contexts/<sessionId>.json` in step with
 * the skills each conversation has chosen. *Applying* that choice to a live
 * agent is a separate concern with its own module (`./apply.ts`), because it
 * needs cordis fiber lifetimes; this file stays pure filesystem + arithmetic.
 *
 * The write is deliberately split from the decision so a caller can apply a
 * change to a live conversation **first** and only persist once that worked:
 *
 *   planSelection()   read + decide   — writes nothing
 *   commitSelection() persist         — writes the decided document
 *
 * A caller that persists first cannot undo it when the apply fails, which left
 * the UI showing "enabled" for something the agent could not see.
 *
 * Guarantees:
 * - A conversation with no selection file inherits the workspace default
 *   (`contexts/_default.json`, edited through the panel's 默认配置 row); with
 *   no default file either it sees no managed skill through this engine
 *   (official roots keep working as dsh ships them).
 * - SKILL.md files are never touched; the choice lives in the JSON per
 *   conversation, so two conversations can hold different selections at once.
 * - The agent toggles through the registered `skill_select` tool, which writes
 *   the same JSON the panel writes — UI and agent always agree.
 * @module
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { findProjectRoot, getRoots } from '../skills/index.ts'

/** Directory (inside the workspace) that holds per-conversation selections. */
export const CONTEXTS_DIR_NAME = 'contexts'

/**
 * Session id the workspace default selection lives under. A conversation
 * without a selection file of its own inherits this selection, so the panel's
 * default row is "the skills new conversations start with". Real dsh session
 * ids never look like this.
 */
export const DEFAULT_CONTEXT_ID = '_default'

/**
 * Ids that name the default rather than a conversation.
 *
 * `default` is not produced by this code — the route accepts any `sessionId`
 * string, so it comes from a caller that sent that value. It is reserved here
 * because a file named after it looks exactly like a conversation and has
 * already been read as one.
 */
const RESERVED_CONTEXT_IDS = new Set<string>([DEFAULT_CONTEXT_ID, 'default'])

/**
 * How one conversation differs from the workspace default.
 *
 * A conversation file records **only the difference**, never the whole set. The
 * default is what a conversation starts from, so editing it has to reach every
 * conversation that never asked for anything else. Storing the pinned set
 * instead — what this module did before — froze the default of that moment into
 * the conversation on its first flip, and no later edit to the default could
 * turn those skills off again ("技能永远关不上").
 */
export interface ContextOverrides {
  /** Slugs this conversation adds on top of the default. */
  on: string[]
  /** Slugs this conversation withholds from the default. */
  off: string[]
}

/** Per-conversation selection document. */
export interface ContextSelection {
  sessionId: string
  /** The effective slug set — what the engine installs, in pick order. */
  selected: string[]
  updatedAt: string
  /** Conversation files only: the diff from the default that made `selected`. */
  overrides?: ContextOverrides
  /** Whether the conversation has a file of its own (false = pure default). */
  configured?: boolean
}

/** One row of the panel's conversation index. */
export interface SelectionRow {
  sessionId: string
  count: number
  updatedAt: string
}

/** A file in the contexts directory that is not a conversation selection. */
export interface IgnoredSelection {
  name: string
  /** Why it was skipped. Today a single reason exists; more are expected. */
  reason: 'reserved'
}

/**
 * Read one conversation's selection: the default with the conversation's own
 * diff applied, or the empty selection when there is neither.
 *
 * A file written by an older version carries a pinned `selected` and no
 * `overrides`; it is read as a diff against the *current* default, which is what
 * lets such a conversation follow later edits (see {@link normaliseSelection}
 * for making that permanent on disk). Tolerates a missing or corrupt file — a
 * broken selection must never take down the plugin or the conversation.
 */
export function readSelection(workspaceRoot: string, sessionId: string): ContextSelection {
  const own = readSelectionFile(workspaceRoot, sessionId)
  if (sessionId === DEFAULT_CONTEXT_ID) {
    return own ?? { sessionId, selected: [], updatedAt: '' }
  }
  const base = defaultSet(workspaceRoot)
  if (own === undefined) {
    // Nothing of its own: the conversation *is* the default, and keeps
    // following it.
    return {
      sessionId, selected: [...base], updatedAt: '', overrides: { on: [], off: [] }, configured: false,
    }
  }
  const overrides = own.overrides ?? diffAgainst(base, own.selected)
  return {
    sessionId,
    selected: applyOverrides(base, overrides),
    updatedAt: own.updatedAt,
    overrides,
    configured: true,
  }
}

/** The default's slug set ([] when there is no default file). */
function defaultSet(workspaceRoot: string): string[] {
  return readSelectionFile(workspaceRoot, DEFAULT_CONTEXT_ID)?.selected ?? []
}

/** The default with a conversation's additions and withholdings applied. */
function applyOverrides(base: string[], overrides: ContextOverrides): string[] {
  const off = new Set(overrides.off)
  const named = new Set(base)
  const on = overrides.on.filter((slug) => !named.has(slug))
  return [...base.filter((slug) => !off.has(slug)), ...on]
}

/** The diff that turns `base` into `selected` — the only thing a file stores. */
export function diffAgainst(base: string[], selected: string[]): ContextOverrides {
  const chosen = new Set(selected)
  const named = new Set(base)
  return {
    on: selected.filter((slug) => !named.has(slug)),
    off: base.filter((slug) => !chosen.has(slug)),
  }
}

/** Read one selection document, or undefined when absent/corrupt. */
function readSelectionFile(workspaceRoot: string, sessionId: string): ContextSelection | undefined {
  const file = selectionPath(workspaceRoot, sessionId)
  if (!existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ContextSelection>
    const selected = Array.isArray(parsed.selected) ? parsed.selected.filter((s): s is string => typeof s === 'string') : []
    const overrides = parseOverrides(parsed.overrides)
    return {
      sessionId,
      selected,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      // A missing diff means "written before conversations stored one"; the
      // caller derives it against the default instead of re-pinning.
      ...(overrides === undefined ? {} : { overrides }),
    }
  } catch {
    return undefined
  }
}

/**
 * The stored diff, when the document carries one in a readable shape.
 *
 * Reading this is not optional bookkeeping: without it every read falls back to
 * deriving a diff from the stored set, which silently re-pins the conversation
 * to the default of the moment it was last written — the exact behaviour the
 * diff exists to avoid.
 */
function parseOverrides(raw: unknown): ContextOverrides | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const row = raw as { on?: unknown; off?: unknown }
  const list = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : []
  )
  return { on: list(row.on), off: list(row.off) }
}

/**
 * Write one conversation's selection atomically (tmp + rename).
 *
 * Only the fields this version owns reach the file: a default keeps its full
 * `selected`, a conversation keeps its diff. A caller that hands over a whole
 * set without a diff gets one derived here — "this conversation selects exactly
 * these" is then stored as the difference from the default, which is what keeps
 * later default edits reaching the skills it never ruled on. `stamp: false`
 * preserves the stored `updatedAt` for a structural rewrite, which is not a
 * user edit.
 */
export function writeSelection(
  workspaceRoot: string,
  selection: ContextSelection,
  options: { stamp?: boolean } = {},
): void {
  const file = selectionPath(workspaceRoot, selection.sessionId)
  mkdirSync(dirname(file), { recursive: true })
  const updatedAt = options.stamp === false ? selection.updatedAt : new Date().toISOString()
  const body = selection.sessionId === DEFAULT_CONTEXT_ID
    ? { sessionId: selection.sessionId, selected: selection.selected, updatedAt }
    : {
      sessionId: selection.sessionId,
      selected: selection.selected,
      overrides: selection.overrides ?? diffAgainst(defaultSet(workspaceRoot), selection.selected),
      updatedAt,
    }
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8')
  renameSync(tmp, file)
}

/** Path of one conversation's selection document. */
export function selectionPath(workspaceRoot: string, sessionId: string): string {
  // The session id is a dsh-minted string; keep the file name safe anyway.
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return join(workspaceRoot, '.dsh', 'S-M-C', CONTEXTS_DIR_NAME, safe + '.json')
}

/**
 * The selection that would result from setting one slug on or off, **without
 * writing anything**.
 *
 * A conversation without a file of its own plans from the default, and the
 * result is expressed as a diff against it — so a conversation that only ever
 * turned one skill off keeps following every other default change. Persisting
 * the whole set here is what used to freeze the default into the conversation.
 *
 * @param selected - the desired state. Omit it to flip whatever is there.
 */
export function planSelection(
  workspaceRoot: string,
  sessionId: string,
  slug: string,
  selected?: boolean,
): ContextSelection {
  const current = readSelection(workspaceRoot, sessionId)
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
    overrides: diffAgainst(defaultSet(workspaceRoot), next),
    configured: true,
  }
}

/**
 * Rewrite one conversation's file in the current shape (a diff, not a pinned
 * set); answers whether anything was written.
 *
 * Called when a panel reads a conversation, so a file an older version wrote
 * stops pinning the default from the moment it is looked at — no bulk migration
 * over workspaces we would have to guess at.
 */
export function normaliseSelection(workspaceRoot: string, sessionId: string): boolean {
  if (sessionId === DEFAULT_CONTEXT_ID) return false
  if (!existsSync(selectionPath(workspaceRoot, sessionId))) return false
  const own = readSelectionFile(workspaceRoot, sessionId)
  if (own === undefined || own.overrides !== undefined) return false
  const base = defaultSet(workspaceRoot)
  const overrides = diffAgainst(base, own.selected)
  writeSelection(
    workspaceRoot,
    { sessionId, selected: applyOverrides(base, overrides), updatedAt: own.updatedAt, overrides },
    { stamp: false },
  )
  return true
}

/**
 * Drop a conversation's file, so it follows the default again.
 * @returns the selection it now inherits.
 */
export function resetSelection(workspaceRoot: string, sessionId: string): ContextSelection {
  if (sessionId !== DEFAULT_CONTEXT_ID) {
    const file = selectionPath(workspaceRoot, sessionId)
    if (existsSync(file)) rmSync(file, { force: true })
  }
  return readSelection(workspaceRoot, sessionId)
}

/** Persist a planned selection. The only writer in this module. */
export function commitSelection(workspaceRoot: string, selection: ContextSelection): void {
  writeSelection(workspaceRoot, selection)
}

/**
 * Plan and persist in one step (the convenience form).
 * Prefer {@link planSelection} + {@link commitSelection} where the caller has a
 * live agent to apply to first.
 */
export function toggleSelection(workspaceRoot: string, sessionId: string, slug: string): ContextSelection {
  const next = planSelection(workspaceRoot, sessionId, slug)
  commitSelection(workspaceRoot, next)
  return next
}

/**
 * Read one workspace's selection index: the default row, every conversation
 * that holds a file, and the files that were skipped.
 *
 * Reserved names are reported rather than silently dropped: a stray
 * `default.json` looks like a conversation, and the last time one appeared it
 * was taken for a schema migration. Naming it in `ignored` is what stops that.
 */
export function readContextIndex(workspaceRoot: string): {
  selections: SelectionRow[]
  ignored: IgnoredSelection[]
} {
  const dir = join(workspaceRoot, '.dsh', 'S-M-C', CONTEXTS_DIR_NAME)
  const defaultSelection = readSelectionFile(workspaceRoot, DEFAULT_CONTEXT_ID)
  const rows: SelectionRow[] = []
  const ignored: IgnoredSelection[] = []
  let names: string[] = []
  try { names = readdirSync(dir) } catch { /* unreadable dir → default only */ }
  for (const name of names.sort()) {
    if (!name.endsWith('.json')) continue
    const sessionId = name.slice(0, -'.json'.length)
    if (RESERVED_CONTEXT_IDS.has(sessionId)) {
      // The default is already the first row; any other reserved id is noise.
      if (sessionId !== DEFAULT_CONTEXT_ID) ignored.push({ name: sessionId, reason: 'reserved' })
      continue
    }
    // The effective set, not the file's copy of it: the default may have moved
    // since the file was written, and the row count has to match what the
    // conversation really installs.
    const selection = readSelection(workspaceRoot, sessionId)
    rows.push({ sessionId, count: selection.selected.length, updatedAt: selection.updatedAt })
  }
  return {
    selections: [
      {
        sessionId: DEFAULT_CONTEXT_ID,
        count: defaultSelection?.selected.length ?? 0,
        updatedAt: defaultSelection?.updatedAt ?? '',
      },
      ...rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    ],
    ignored,
  }
}

/** The conversation rows alone — the index's original shape. */
export function listSelections(workspaceRoot: string): SelectionRow[] {
  return readContextIndex(workspaceRoot).selections
}

/** Workspace root for a cwd: the nearest .git ancestor (dsh's own rule). */
export function workspaceOf(cwd?: string): string {
  return findProjectRoot(cwd)
}

/** Read-only snapshot combining the selection with resolvable rows (panel). */
export function selectionDetail(workspaceRoot: string, sessionId: string): ContextSelection {
  return readSelection(workspaceRoot, sessionId)
}

/** Default workspace fallback used by routes without an explicit cwd. */
export function defaultWorkspace(): string {
  return getRoots().dshHome
}
