/**
 * The link ledger (`S-M-C/skills-links.json`) — group 4's bookkeeping.
 *
 * Every junction this plugin creates is written down here, because a link on
 * disk carries no memory of why it exists. The ledger is what makes the UI able
 * to tell a link *we* made (safe to rebuild, safe to remove) from one somebody
 * else made (a red flag the user has to decide about) — and it is the only
 * reason a store relocation can repair its links instead of orphaning them.
 *
 * Link paths are compared case-folded, matching the underlying filesystem on
 * Windows where the same path has many spellings.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { storeRoot, storeSkillsLinksPath } from '../../shared/paths.ts'
import type { LinkRecord, SkillLinks } from '../../shared/protocol/index.ts'

/** An empty ledger. */
export function emptyLinks(): SkillLinks {
  return { version: 1, links: [] }
}

/** Read the link ledger, tolerating a missing or corrupt file. */
export function readLinks(): SkillLinks {
  const file = storeSkillsLinksPath()
  if (!existsSync(file)) return emptyLinks()
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as SkillLinks).links)) {
      throw new Error('malformed link ledger')
    }
    return parsed as SkillLinks
  } catch {
    return emptyLinks()
  }
}

/** Write the link ledger atomically. */
export function writeLinks(links: SkillLinks): void {
  mkdirSync(storeRoot(), { recursive: true })
  const file = storeSkillsLinksPath()
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(links, null, 2), 'utf8')
  renameSync(tmp, file)
}

/** Ledger record for one link path, when present. */
export function linkRecordOf(linkPath: string): LinkRecord | undefined {
  const want = fold(resolve(linkPath))
  return readLinks().links.find((l) => fold(resolve(l.linkPath)) === want)
}

/** Append one ledger record (replacing any record for the same link path). */
export function trackLink(record: LinkRecord): void {
  const ledger = readLinks()
  const want = fold(resolve(record.linkPath))
  ledger.links = ledger.links.filter((l) => fold(resolve(l.linkPath)) !== want)
  ledger.links.push(record)
  writeLinks(ledger)
}

/** Remove the ledger record for one link path; a no-op when there is none. */
export function untrackLink(linkPath: string): void {
  const ledger = readLinks()
  const want = fold(resolve(linkPath))
  const next = ledger.links.filter((l) => fold(resolve(l.linkPath)) !== want)
  if (next.length !== ledger.links.length) writeLinks({ version: 1, links: next })
}

/** Fold a path for comparison: case-insensitive on Windows, as-is elsewhere. */
export function fold(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p
}
