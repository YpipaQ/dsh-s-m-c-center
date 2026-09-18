/**
 * The relay table: one document that holds every session-skill selection.
 *
 * ## Why one file instead of one per workspace
 *
 * The selection used to live in `<workspace>/.dsh/S-M-C/contexts/<sessionId>
 * .json`. Reading it therefore required resolving a workspace first, and that
 * resolution was the source of everything that went wrong:
 *
 * - **Two answers to one question.** The settings page asks with the cwd dsh
 *   reports for the page; the sidebar asks for a conversation and gets the
 *   workspace *that conversation* runs in. Same user, same switch, two files.
 * - **State nobody can find.** A workspace with no project marker resolved to
 *   the volume root, so its conversations all shared `G:\.dsh\S-M-C\contexts\`
 *   — and looked like they had no config at all.
 * - **Defaults that could not be turned off.** A conversation's file pinned the
 *   default of the moment it was written, and a later edit to the default
 *   reached only the conversations that had never been touched.
 *
 * The state is per-conversation, and a session id is already unique machine-
 * wide. So the key is the session id and the file is one: nothing has to guess
 * a directory, and both panels read the same bytes. Files are still read for
 * the one-shot import of an older layout — see `importLegacyContexts` in
 * `./engine.ts` — but nothing new is ever written per workspace again.
 *
 * ## Shape
 *
 * ```json
 * {
 *   "version": 1,
 *   "default":  { "selected": ["demo-skill"], "updatedAt": "..." },
 *   "sessions": { "<sessionId>": { "on": ["x"], "off": ["y"], "updatedAt": "..." } }
 * }
 * ```
 *
 * `default` is the starting set for every conversation; a session entry is
 * **only the difference** from it (additions `on`, withholdings `off`), so
 * editing the default reaches every conversation that never ruled on a skill
 * itself.
 *
 * This module is storage plus pure arithmetic. Deciding *what* a conversation
 * selects — and the one-shot import — is `./engine.ts`.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { storeContextTablePath } from '../../shared/paths.ts'

/** Schema version written into the document; a later version may migrate it. */
export const CONTEXT_TABLE_VERSION = 1

/** How one conversation differs from the default. */
export interface ContextOverrides {
  /** Slugs this conversation adds on top of the default. */
  on: string[]
  /** Slugs this conversation withholds from the default. */
  off: string[]
}

/** One conversation's row: the diff, plus when it was last written. */
export interface ContextTableEntry extends ContextOverrides {
  updatedAt: string
}

/** The whole document. */
export interface ContextTable {
  version: number
  default: { selected: string[]; updatedAt: string }
  sessions: Record<string, ContextTableEntry>
}

/** Where the table lives — surfaced in the UI so the state is findable. */
export function contextTablePath(): string {
  return storeContextTablePath()
}

/**
 * An empty table (no default, no conversations).
 *
 * `sessions` is a **null-prototype** map on purpose. On a plain object,
 * `sessions['__proto__']` answers with `Object.prototype` — a truthy value
 * where the caller asked "is there a row named this?", so such a lookup would
 * be read as a configured conversation.
 */
export function emptyTable(): ContextTable {
  return {
    version: CONTEXT_TABLE_VERSION,
    default: { selected: [], updatedAt: '' },
    sessions: emptySessions(),
  }
}

/** A session map whose lookups cannot reach `Object.prototype`. */
function emptySessions(): Record<string, ContextTableEntry> {
  return Object.create(null) as Record<string, ContextTableEntry>
}

/**
 * Read the table, tolerating anything.
 *
 * A hand-edited or truncated document must never take down the panel or a
 * conversation: an unreadable table reads as an empty one, and the next write
 * repairs it. Every field is validated here rather than at the call sites, so
 * callers can treat the result as well-formed.
 */
export function readContextTable(): ContextTable {
  const file = contextTablePath()
  if (!existsSync(file)) return emptyTable()
  try {
    return parseTable(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return emptyTable()
  }
}

/**
 * Write the table atomically (temp file + rename).
 *
 * Only the keys this version owns reach the file; anything unknown is dropped
 * rather than carried along, so a field an older version wrote cannot sit in a
 * user-visible document looking alive.
 */
export function writeContextTable(table: ContextTable): void {
  const file = contextTablePath()
  mkdirSync(dirname(file), { recursive: true })
  const body: ContextTable = {
    version: CONTEXT_TABLE_VERSION,
    default: {
      selected: asStringList(table.default?.selected),
      updatedAt: asText(table.default?.updatedAt),
    },
    sessions: emptySessions(),
  }
  for (const [sessionId, entry] of Object.entries(table.sessions ?? {})) {
    if (!isSessionId(sessionId) || isReservedSessionId(sessionId)) continue
    body.sessions[sessionId] = {
      on: asStringList(entry?.on),
      off: asStringList(entry?.off),
      updatedAt: asText(entry?.updatedAt),
    }
  }
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(body, null, 2) + '\n', 'utf8')
  renameSync(tmp, file)
}

/**
 * Session keys that name the default rather than a conversation.
 *
 * `default` is not produced by this code — the route accepts any string — so it
 * comes from a caller that sent that value. It is reserved because a row named
 * after it looks exactly like a conversation, and one has already been read as
 * such.
 */
export function isReservedSessionId(sessionId: string): boolean {
  return sessionId === '_default' || sessionId === 'default'
}

/**
 * Reserved keys actually present in the document.
 *
 * Reported rather than silently dropped: a stray `default` row is a sign that
 * something wrote state under a name this code does not own, and the last time
 * that happened it was mistaken for a schema migration.
 */
export function scanReservedSessionKeys(): string[] {
  const file = contextTablePath()
  if (!existsSync(file)) return []
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { sessions?: Record<string, unknown> }
    const keys = Object.keys(raw.sessions ?? {})
    return keys.filter((key) => key === 'default')
  } catch {
    return []
  }
}

/** A well-formed table from whatever was on disk. */
function parseTable(raw: unknown): ContextTable {
  if (typeof raw !== 'object' || raw === null) return emptyTable()
  const doc = raw as { default?: unknown; sessions?: unknown }
  const table = emptyTable()
  const fallback = doc.default as { selected?: unknown; updatedAt?: unknown } | undefined
  if (typeof fallback === 'object' && fallback !== null) {
    table.default = {
      selected: asStringList(fallback.selected),
      updatedAt: asText(fallback.updatedAt),
    }
  }
  const sessions = doc.sessions
  if (typeof sessions === 'object' && sessions !== null) {
    for (const [sessionId, entry] of Object.entries(sessions as Record<string, unknown>)) {
      if (!isSessionId(sessionId) || isReservedSessionId(sessionId)) continue
      const row = entry as { on?: unknown; off?: unknown; updatedAt?: unknown } | null
      if (typeof row !== 'object' || row === null) continue
      table.sessions[sessionId] = {
        on: asStringList(row.on),
        off: asStringList(row.off),
        updatedAt: asText(row.updatedAt),
      }
    }
  }
  return table
}

/**
 * Keys that cannot be stored as a key at all.
 *
 * Assigning `__proto__` onto a plain object rewrites that object's prototype
 * instead of adding a row, and `constructor` / `prototype` are the same trap.
 * They are refused rather than renamed: a row under one of them could never be
 * read back, so accepting it would be a write that reports success and stores
 * nothing.
 */
const UNSAFE_SESSION_IDS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Whether a key can be used as a session id at all.
 *
 * Deliberately permissive: dsh mints these, and the id reaches the document as
 * a JSON key, never a path segment. An earlier version also refused every id
 * starting with `__`, which silently dropped legitimate rows — a write that
 * answered `ok` and stored nothing (found by probing the live routes with such
 * an id).
 */
function isSessionId(value: string): boolean {
  return value !== '' && !UNSAFE_SESSION_IDS.has(value)
}

/** The default with one conversation's additions and withholdings applied. */
export function applyOverrides(base: string[], overrides: ContextOverrides): string[] {
  const off = new Set(overrides.off)
  const named = new Set(base)
  const on = overrides.on.filter((slug) => !named.has(slug))
  return [...base.filter((slug) => !off.has(slug)), ...on]
}

/** The diff that turns `base` into `selected` — the only thing a row stores. */
export function diffAgainst(base: string[], selected: string[]): ContextOverrides {
  const chosen = new Set(selected)
  const named = new Set(base)
  return {
    on: selected.filter((slug) => !named.has(slug)),
    off: base.filter((slug) => !chosen.has(slug)),
  }
}

/** Read a JSON field as a list of non-empty strings. */
export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item !== '')
}

/** Read a JSON field as text. */
export function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
