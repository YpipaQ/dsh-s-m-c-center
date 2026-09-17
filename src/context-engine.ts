/**
 * The conversation context engine — phase two's selection layer.
 *
 * One job: keep `~/.dsh/<workspace>/.dsh/S-M-C/contexts/<sessionId>.json` in
 * step with the skills each conversation has chosen, and mirror that choice
 * into the official skill registry as agent-scoped runtime registrations
 * (`agent.ctx.skills.register()` / its disposer). Everything downstream —
 * catalog messages, the `skill` tool, `/name` gestures — stays official; the
 * engine only decides *which* skills a given conversation can see.
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
import type { Context } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import { findProjectRoot, getRoots } from './skills.ts'

/** Directory (inside the workspace) that holds per-conversation selections. */
export const CONTEXTS_DIR_NAME = 'contexts'

/**
 * Session id the workspace default selection lives under. A conversation
 * without a selection file of its own inherits this selection, so the panel's
 * default row is "the skills new conversations start with". Real dsh session
 * ids never look like this.
 */
export const DEFAULT_CONTEXT_ID = '_default'

/** Per-conversation selection document. */
export interface ContextSelection {
  sessionId: string
  /** Selected skill slugs (store / registry identity), in pick order. */
  selected: string[]
  updatedAt: string
}

export interface ContextEngineDeps {
  /**
   * Resolve the skills a slug names, so the engine can register the chosen
   * skills with the official registry: full body included.
   * @returns the registration input, or undefined when the skill is gone.
   */
  resolve: (slug: string) => SkillRegistration | undefined
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
 * Apply one conversation's selection to its agent: register the chosen skills
 * into the agent's private layer, dispose everything this engine registered
 * before. Returns the composite disposer for the new set.
 */
export function applySelection(
  agentCtx: Context,
  workspaceRoot: string,
  sessionId: string,
  deps: ContextEngineDeps,
): () => void {
  const selection = readSelection(workspaceRoot, sessionId)
  const disposers: Array<() => void> = []
  for (const slug of selection.selected) {
    const registration = deps.resolve(slug)
    if (registration === undefined) continue // canonical copy vanished; refresh will flag it
    // Registered through the agent's own context → lands in the agent's
    // private layer (see tests/context-engine.test.ts for the pinned claim).
    disposers.push(agentCtx.skills.register(registration))
  }
  return () => { for (const dispose of disposers) { try { dispose() } catch { /* already gone */ } } }
}

/**
 * List every conversation selection under one workspace (panel index).
 * The workspace default (`_default`) is always present as the first row —
 * the dropdown's "skills new conversations start with" entry — followed by
 * the conversations that hold a file, newest change first.
 */
export function listSelections(workspaceRoot: string): Array<{ sessionId: string; count: number; updatedAt: string }> {
  const dir = join(workspaceRoot, '.dsh', 'S-M-C', CONTEXTS_DIR_NAME)
  const out: Array<{ sessionId: string; count: number; updatedAt: string }> = []
  const defaultSelection = readSelectionFile(workspaceRoot, DEFAULT_CONTEXT_ID)
  out.push({
    sessionId: DEFAULT_CONTEXT_ID,
    count: defaultSelection?.selected.length ?? 0,
    updatedAt: defaultSelection?.updatedAt ?? '',
  })
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue
      const sessionId = name.slice(0, -'.json'.length)
      if (sessionId === DEFAULT_CONTEXT_ID) continue // already pinned first
      const selection = readSelectionFile(workspaceRoot, sessionId)
      if (selection === undefined) continue
      out.push({ sessionId, count: selection.selected.length, updatedAt: selection.updatedAt })
    }
  } catch { /* unreadable dir → default only */ }
  return [
    out[0],
    ...out.slice(1).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
  ]
}

/** Workspace root for a cwd: the nearest .git ancestor (dsh's own rule). */
export function workspaceOf(cwd?: string): string {
  return findProjectRoot(cwd)
}

/** Read-only snapshot combining the selection with resolvable rows (panel). */
export function selectionDetail(workspaceRoot: string, sessionId: string): ContextSelection {
  return readSelection(workspaceRoot, sessionId)
}

/** Flip one slug in one conversation's selection and persist it. */
export function toggleSelection(workspaceRoot: string, sessionId: string, slug: string): ContextSelection {
  const current = readSelection(workspaceRoot, sessionId)
  const selected = current.selected.includes(slug)
    ? current.selected.filter((s) => s !== slug)
    : [...current.selected, slug]
  const next: ContextSelection = { sessionId, selected, updatedAt: '' }
  writeSelection(workspaceRoot, next)
  return next
}

/** Default workspace fallback used by routes without an explicit cwd. */
export function defaultWorkspace(): string {
  return getRoots().dshHome
}
