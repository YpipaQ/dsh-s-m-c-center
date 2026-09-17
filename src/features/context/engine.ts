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

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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

/** Per-conversation selection document. */
export interface ContextSelection {
  sessionId: string
  /** Selected skill slugs (store / registry identity), in pick order. */
  selected: string[]
  updatedAt: string
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
 * Read one conversation's selection: its own file when it has one, otherwise
 * the workspace default, otherwise the empty selection. The fallback is what
 * makes the panel's 默认配置 row real — a fresh conversation starts with the
 * default picks already registered. Tolerates a missing or corrupt file — a
 * broken selection must never take down the plugin or the conversation.
 */
export function readSelection(workspaceRoot: string, sessionId: string): ContextSelection {
  const own = readSelectionFile(workspaceRoot, sessionId)
  if (own !== undefined) return own
  if (sessionId !== DEFAULT_CONTEXT_ID) {
    const inherited = readSelectionFile(workspaceRoot, DEFAULT_CONTEXT_ID)
    if (inherited !== undefined) return { ...inherited, sessionId }
  }
  return { sessionId, selected: [], updatedAt: '' }
}

/** Read one selection document, or undefined when absent/corrupt. */
function readSelectionFile(workspaceRoot: string, sessionId: string): ContextSelection | undefined {
  const file = selectionPath(workspaceRoot, sessionId)
  if (!existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ContextSelection>
    const selected = Array.isArray(parsed.selected) ? parsed.selected.filter((s): s is string => typeof s === 'string') : []
    return { sessionId, selected, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '' }
  } catch {
    return undefined
  }
}

/** Write one conversation's selection atomically (tmp + rename). */
export function writeSelection(workspaceRoot: string, selection: ContextSelection): void {
  const file = selectionPath(workspaceRoot, selection.sessionId)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify({ ...selection, updatedAt: new Date().toISOString() }, null, 2), 'utf8')
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
 * A conversation without its own file plans from the inherited default, so its
 * first commit pins the inherited picks plus the change — that is what makes
 * "the default is just a starting point" true.
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
  return { sessionId, selected: next, updatedAt: current.updatedAt }
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
    const selection = readSelectionFile(workspaceRoot, sessionId)
    if (selection === undefined) continue
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
