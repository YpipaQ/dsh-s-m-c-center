/**
 * Creating, removing and verifying the `~/.dsh/skills/<slug>` links.
 *
 * A link is how a skill that lives in the store (or in some external directory)
 * becomes visible to the agent, which only scans dsh's own roots. Every create
 * writes a ledger record in the same step, so the pair can never drift into the
 * "link on disk, no record" state the UI reports as a red flag.
 *
 * Windows needs junctions rather than symlinks: a junction needs no elevation
 * and no developer mode, and it is removed with `rmdirSync`.
 * @module
 */

import { existsSync, mkdirSync, readdirSync, rmdirSync, statSync, symlinkSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { admissionDoc } from '../../shared/frontmatter.ts'
import { storeSkillsDir } from '../../shared/paths.ts'
import type { VerifyResult } from '../../shared/protocol/index.ts'
import { getRoots, inside, isLink, linkTarget } from './roots.ts'
import { linkRecordOf, readLinks, trackLink, untrackLink } from './links.ts'
import { entryOf } from './store-index.ts'
import { readRegistry, registryEntryOf } from './registry.ts'

/** Link kind: junctions need no elevation on Windows, symlinks elsewhere. */
export const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir'

/** The link path for one slug, under dsh's own skills root. */
export function linkPathOf(slug: string): string {
  return join(getRoots().userSkillsDir, slug)
}

/**
 * Whether a link exists for one slug — the same question the scanner asks when
 * it decides a row's `linked` flag.
 */
export function linkedPathOf(slug: string): string | undefined {
  const link = linkPathOf(slug)
  return isLink(link) ? link : undefined
}

/** Remove a link entry, whichever way the platform needs. */
function unlinkEntry(path: string): void {
  if (process.platform === 'win32') rmdirSync(path)
  else unlinkSync(path)
}

/**
 * Create the link `~/.dsh/skills/<slug>` → `target` and write the ledger
 * record. Refuses to overwrite a real directory; an existing link is a no-op.
 */
export function createLink(slug: string, target: string): void {
  const roots = getRoots()
  mkdirSync(roots.userSkillsDir, { recursive: true })
  const link = join(roots.userSkillsDir, slug)
  if (isLink(link)) return
  if (existsSync(link)) throw new Error('已存在同名条目：' + link)
  symlinkSync(resolve(target), link, LINK_TYPE)
  trackLink({
    slug,
    linkPath: link,
    targetPath: resolve(target),
    createdAt: new Date().toISOString(),
  })
}

/**
 * Remove the link `~/.dsh/skills/<slug>` and its ledger record. Only ever
 * removes a link — a real directory is left alone so a stray path can never
 * delete real skills.
 */
export function removeLink(slug: string): void {
  const link = linkPathOf(slug)
  untrackLink(link)
  if (!isLink(link)) return
  unlinkEntry(link)
}

/**
 * Remove a link at an explicit path (the untracked-link case, where the slug is
 * not what is on disk).
 */
export function removeLinkAt(linkPath: string): void {
  untrackLink(linkPath)
  if (!isLink(linkPath)) return
  unlinkEntry(linkPath)
}

/**
 * Repoint every ledger-tracked link that targets `from` at `to`.
 *
 * A junction stores an absolute target string, so moving the store silently
 * breaks every link into it. This is the repair step the store-root migration
 * runs right after moving. Links the ledger never saw get a repair pass too —
 * they point into the same directory, so they share the problem.
 * @returns how many links were rebuilt.
 */
export function relinkSkills(from: string, to: string): number {
  const base = resolve(from)
  let count = 0
  for (const record of readLinks().links) {
    if (!inside(base, record.targetPath)) continue
    const link = linkPathOf(record.slug)
    try {
      if (isLink(link)) unlinkEntry(link)
      const next = join(to, basename(record.targetPath))
      symlinkSync(next, link, LINK_TYPE)
      trackLink({ ...record, linkPath: link, targetPath: next })
      count++
    } catch { /* the caller reports the state through a rescan */ }
  }
  // Links the ledger never saw still deserve a repair pass.
  const roots = getRoots()
  for (const dir of [roots.userSkillsDir, roots.agentsSkillsDir]) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (!isLink(full)) continue
      const target = linkTarget(full)
      if (target === undefined || !inside(base, resolve(dir, target))) continue
      try {
        unlinkEntry(full)
        symlinkSync(join(to, basename(target)), full, LINK_TYPE)
        count++
      } catch { /* rescan reports */ }
    }
  }
  return count
}

/**
 * Verify a link: does it still resolve, and does the target still hold an
 * admission document (SKILL.md or DESCRIPTION.md)? Used by the UI for
 * red-flagged (untracked) links.
 */
export function verifyLink(slugOrPath: string): VerifyResult {
  const link = existsSync(slugOrPath) && isLink(slugOrPath)
    ? slugOrPath
    : linkPathOf(slugOrPath)
  if (!isLink(link)) return { ok: false, reason: '不是联接：' + link }
  const target = linkTarget(link)
  if (target === undefined) return { ok: false, reason: '联接目标不可读：' + link }
  const resolved = resolve(dirname(link), target)
  if (!existsSync(resolved)) return { ok: false, reason: '联接目标已不存在：' + resolved }
  const mdPath = statSync(resolved).isDirectory() ? admissionDoc(resolved) : resolved
  if (mdPath === undefined) return { ok: false, reason: '联接目标里没有 SKILL.md 或 DESCRIPTION.md：' + resolved }
  const tracked = linkRecordOf(link) !== undefined
  const stored = inside(storeSkillsDir(), resolved)
  return { ok: true, tracked, stored, target: resolved, mdPath }
}

/**
 * Create (or confirm) the link for a stored or registered skill.
 *
 * A store slug links straight at its store copy; a registered slug links at its
 * external directory, or at the directory holding the flat `.md` file.
 */
export function linkSkill(slug: string): void {
  const stored = entryOf(slug)
  if (stored !== undefined) {
    createLink(slug, join(storeSkillsDir(), slug))
    return
  }
  const registered = registryEntryOf(slug)
  if (registered === undefined) throw new Error('找不到技能：' + slug)
  const target = registered.kind === 'file' ? dirname(registered.path) : registered.path
  createLink(slug, target)
}

/** Remove the link for a skill (the canonical copy is never touched). */
export function unlinkSkill(slug: string): void {
  removeLink(slug)
}

/**
 * Delete a link the ledger has no record of (the red-flag row's action).
 * Refuses a tracked link so the normal unlink stays the only path that also
 * clears the ledger record.
 */
export function deleteUntrackedLink(linkPath: string): void {
  if (!isLink(linkPath)) throw new Error('不是联接：' + linkPath)
  if (linkRecordOf(linkPath) !== undefined) {
    throw new Error('联接有账本记录，请用常规取消联接：' + linkPath)
  }
  unlinkEntry(linkPath)
}

/** Resolve a link path back to the skill it serves, or undefined. */
export function resolveByLink(linkPath: string): { slug: string; target: string } | undefined {
  const target = linkTarget(linkPath)
  if (target === undefined) return undefined
  const resolved = resolve(dirname(linkPath), target)
  const store = storeSkillsDir()
  if (inside(store, resolved)) return { slug: basename(resolved), target: resolved }
  const reg = readRegistry().entries.find((e) => inside(resolve(e.path), resolved) || resolve(e.path) === resolved)
  if (reg !== undefined) return { slug: reg.slug, target: resolved }
  return undefined
}
