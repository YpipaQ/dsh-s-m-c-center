/**
 * Registry operations: importing external skills, dropping them, and the
 * traceability pass.
 *
 * The registry is the ledger for skills that stay where they are, so these are
 * the flows that do *not* move anything — importing records a path, and the
 * refresh pass only checks whether that path is still there.
 * @module
 */

import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import {
  admissionDoc, parseBundleDocs, parseFlatDoc, parseSkillFile, slugify, uniqueSlug,
} from '../../shared/frontmatter.ts'
import { removeLink } from './linking.ts'
import { listSkills } from './scanner.ts'
import { readStoreIndex } from './store-index.ts'
import type { RegistryEntry, SkillSummary } from '../../shared/protocol/index.ts'
import { dropRegistryEntry, readRegistry, upsertRegistryEntry, writeRegistry } from './registry.ts'

/**
 * Register external skills: the canonical copy stays where it is, only a
 * record goes into `skills-registry.json`. This is the flow for "skills in
 * arbitrary directories" per the four-group model.
 *
 * Per-item failures are collected rather than thrown, so one bad pick does not
 * abandon the rest of the batch.
 */
export function registerExternal(
  items: Array<{ sourcePath: string; kind: 'bundle' | 'file' }>,
): Array<{ name: string; ok: boolean; reason?: string }> {
  const results: Array<{ name: string; ok: boolean; reason?: string }> = []
  for (const it of items) {
    try {
      const parsed = it.kind === 'bundle'
        ? parseBundleDocs(it.sourcePath)?.parsed ?? null
        : parseSkillFile(readFileSync(it.sourcePath, 'utf8'))
      if (parsed === null) throw new Error('不是有效的技能文件：' + it.sourcePath)
      const taken = new Set<string>([
        ...readRegistry().entries.map((e) => e.slug),
        ...readStoreIndex().entries.map((e) => e.slug),
      ])
      const slug = uniqueSlug(taken, slugify(parsed.name || basename(it.sourcePath, extname(it.sourcePath))))
      upsertRegistryEntry({
        slug,
        name: parsed.name,
        description: parsed.description,
        path: it.sourcePath,
        kind: it.kind,
        origin: 'external',
        registeredAt: new Date().toISOString(),
      })
      results.push({ name: parsed.name, ok: true })
    } catch (e) {
      results.push({ name: it.sourcePath, ok: false, reason: String((e as Error)?.message ?? e) })
    }
  }
  return results
}

/** Drop a registry entry (and its link, when one exists). */
export function unregisterExternal(slug: string): void {
  removeLink(slug)
  dropRegistryEntry(slug)
}

/**
 * One registry entry's traceability verdict.
 *
 * `ok` is the whole story for the UI (a row is either traceable or flagged),
 * while `reason` and `mdPath` are what make a failure *actionable*: "the record
 * has no row in the list at all" and "the directory is there but the skill
 * inside it was deleted" call for different repairs.
 */
export interface TraceResult {
  slug: string
  name: string
  ok: boolean
  /** Why it failed, when it did; '' when healthy. */
  reason: string
  /** The admission document the entry resolves to, when healthy. */
  mdPath?: string
}

/** One traceability pass: what survived on disk, and what was dropped as an orphan. */
export interface RefreshResult {
  /** One verdict per record that had a row to trace. */
  results: TraceResult[]
  /** How many ledger records were dropped for having no row in the list. */
  pruned: number
}

/**
 * Trace one registry entry: does its canonical path still exist *and* still
 * hold a skill?
 *
 * An existence check alone was the older behaviour and it answered the wrong
 * question — a bundle directory that survives while its SKILL.md is deleted
 * passed, as did a flat `.md` file renamed to something unparsable. Both leave
 * a row that lists fine and cannot be linked or loaded, which is exactly what
 * this pass exists to catch. The document check mirrors the admission rule
 * (SKILL.md or DESCRIPTION.md) so it never flags a legal DESCRIPTION.md
 * bundle as broken.
 */
function traceEntry(entry: RegistryEntry): TraceResult {
  const fail = (reason: string): TraceResult => ({ slug: entry.slug, name: entry.name, ok: false, reason })
  if (!existsSync(entry.path)) return fail('path is gone: ' + entry.path)
  const doc = entry.kind === 'bundle'
    ? admissionDoc(entry.path)
    : (parseFlatDoc(entry.path) === null ? undefined : entry.path)
  if (doc === undefined) {
    return fail(entry.kind === 'bundle'
      ? 'no SKILL.md or DESCRIPTION.md in: ' + entry.path
      : 'not a valid skill document: ' + entry.path)
  }
  return { slug: entry.slug, name: entry.name, ok: true, reason: '', mdPath: doc }
}

/**
 * Walk the registry and refresh every entry's traceability verdict, persisting
 * the outcome: `lastSeen` when the skill is still there, `missing` (with its
 * reason) when it is not.
 *
 * The pass runs in two stages, and they do different things because the two
 * failures are different in kind:
 *
 * 1. **Is there a row at all?** A record whose slug does not appear in the list
 *    is **dropped**. Nothing points at it, so it can never be shown, linked or
 *    loaded — it is not a broken skill, it is no skill. Keeping it flagged would
 *    bury the real problems under records no user can act on. This is settled
 *    from the list alone, with no filesystem work: the disk is not the authority
 *    here, the list is. (A `native` entry from another workspace lands here
 *    naturally — it is scanned into the list only while its own project is open,
 *    so outside it the record has no row and goes. No special case needed.)
 * 2. **Does it still resolve?** Only for records that *do* have a row: the path
 *    is checked for existence and for a document, and a failure is written onto
 *    the row.
 *
 * Persisting the *failure* is the point of stage 2. A verdict that only lives in
 * the toast disappears with the click, and the stale row then reads as healthy
 * again on the next mount — the panel offers to link a skill that cannot be
 * linked. Writing it onto the row makes the flag survive reloads until a
 * refresh clears it.
 *
 * @param rows - the skills currently listed. Defaults to a fresh scan.
 *   Callers should pass the list they are showing, **scanned with the same cwd**:
 *   project-level rows only exist under their own workspace, so a pass that
 *   scanned elsewhere would compare the registry against a list missing them
 *   and drop those records as orphans.
 * @returns one verdict per *surviving* record, plus how many orphans were
 * dropped — the count is worth showing, because a user whose ledger quietly
 * shrank should be told rather than left to notice.
 */
export function refreshRegistry(rows?: SkillSummary[]): RefreshResult {
  const reg = readRegistry()
  const list = rows ?? listSkills()
  const listed = new Set(list.map((r) => r.slug).filter((s): s is string => s !== undefined))
  const results: TraceResult[] = []
  const kept: RegistryEntry[] = []
  let pruned = 0
  for (const entry of reg.entries) {
    // Stage 1: no row means the record is an orphan, and orphans are removed
    // rather than flagged — there is nothing for the user to fix, and leaving
    // them in place would only pad the list of things that look broken.
    if (!listed.has(entry.slug)) { pruned++; continue }
    kept.push(entry)

    // Stage 2: the row exists, so ask the disk whether it still resolves.
    const verdict = traceEntry(entry)
    results.push(verdict)
    if (verdict.ok) {
      entry.lastSeen = new Date().toISOString()
      if (entry.missing !== undefined) delete entry.missing
    } else {
      entry.missing = { at: new Date().toISOString(), reason: verdict.reason }
    }
  }
  // The file is rewritten either way: a prune has to land even when every
  // surviving record was already healthy, which leaves the verdicts unchanged
  // but still shrinks the ledger.
  reg.entries = kept
  writeRegistry(reg)
  return { results, pruned }
}

/**
 * The registry entry a given skill path belongs to, for the delete flow.
 *
 * Matches the entry's own directory (so a bundle's SKILL.md resolves to it) or
 * the path itself (a flat `.md` row).
 */
export function registryEntryForDelete(path: string) {
  return readRegistry().entries.find((e) =>
    resolve(e.path).toLowerCase() === resolve(dirname(path)).toLowerCase()
    || resolve(path).toLowerCase() === resolve(e.path).toLowerCase(),
  )
}
