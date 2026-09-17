/**
 * Listing and scanning: turning the four roots plus three ledgers into rows.
 *
 * The four groups are assembled differently and that is the whole difficulty:
 * `native` rows come from walking real directories, `stored` and `registered`
 * rows come from ledgers (minus the ones the walk already found through a
 * link), and the links themselves are a property of either. The compensation
 * steps below exist so a skill is never listed twice and never dropped just
 * because its link is missing.
 * @module
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import {
  admissionDoc, parseBundleDocs, parseDescriptionFile, parseFlatDoc, parseSkillFile, slugify,
} from '../../shared/frontmatter.ts'
import { treeSize } from '../../shared/fs-utils.ts'
import { storeSkillsDir } from '../../shared/paths.ts'
import type { ScannedSkill, SkillDetail, SkillSource, SkillSummary } from '../../shared/protocol/index.ts'
import { entryKind, inside, isLink, levelOf, linkTarget, scanTargets } from './roots.ts'
import { linkRecordOf } from './links.ts'
import { linkedPathOf } from './linking.ts'
import { entryOf, readStoreIndex, upsertEntry } from './store-index.ts'
import { readRegistry, registryEntryOf, registryEntryOfByPath, upsertRegistryEntry } from './registry.ts'

/** Parse one bundle safely (SKILL.md or DESCRIPTION.md); undefined when it is not a skill. */
function parseBundleDir(full: string) {
  return parseBundleDocs(full)?.parsed
}

/** Parse one flat `.md` file safely; undefined when it is not a skill. */
function parseFlatFile(full: string) {
  return parseFlatDoc(full) ?? undefined
}

/**
 * Walk one skill root and produce rows for everything found there. Real
 * directories/files become native rows (auto-registered); links become linked
 * rows whose group follows the link target (stored / registered), or untracked
 * red-flag rows when the ledger has no record of them.
 */
function scanRootInto(dir: string, source: SkillSource, seen: Set<string>, items: SkillSummary[]): void {
  if (!existsSync(dir)) return
  let entries: Dirent[]
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  const store = storeSkillsDir()
  for (const entry of entries) {
    const name = entry.name
    if (!name || name === '.system' || name[0] === '.') continue
    const full = join(dir, name)
    const kind = entryKind(full, entry)
    if (kind === undefined) continue

    // Linked entry: the interesting case.
    if (isLink(full)) {
      if (seen.has(full)) continue
      seen.add(full)
      const target = linkTarget(full)
      const resolved = target === undefined ? undefined : resolve(dir, target)
      if (resolved === undefined) continue
      const tracked = linkRecordOf(full)
      let parsed: ReturnType<typeof parseBundleDir>
      let doc: string | undefined
      if (existsSync(resolved)) {
        const info = statSync(resolved)
        if (info.isDirectory()) {
          const found = parseBundleDocs(resolved)
          if (found !== undefined) { parsed = found.parsed; doc = found.doc }
        } else if (info.isFile()) {
          parsed = parseFlatFile(resolved)
          doc = resolved
        }
      }
      const stored = inside(store, resolved)
      const slug = stored ? basename(resolved) : (tracked?.slug ?? registryEntryOfByPath(resolved)?.slug ?? slugify(name))
      items.push({
        name: parsed?.name ?? name,
        description: parsed?.description ?? '',
        whenToUse: parsed?.whenToUse ?? '',
        group: stored ? 'stored' : 'registered',
        announce: stored
          ? (entryOf(slug)?.announce ?? true)
          : (registryEntryOf(slug)?.announce ?? registryEntryOfByPath(resolved)?.announce ?? true),
        linked: true,
        untracked: tracked === undefined,
        source,
        level: levelOf(source),
        kind: 'bundle',
        path: stored ? (doc ?? join(store, slug, 'SKILL.md')) : resolved,
        slug,
      })
      continue
    }

    // Real file/directory: a native skill (or something that is not one).
    const found = kind === 'directory' ? parseBundleDocs(full) : undefined
    const parsed = found !== undefined
      ? found.parsed
      : (kind === 'file' && name.endsWith('.md') && name !== 'DESCRIPTION.md' ? parseFlatFile(full) : undefined)
    if (parsed === undefined) continue
    if (seen.has(full)) continue
    seen.add(full)
    const slug = slugify(parsed.name)
    // Auto-register so the announcement flag has a home ("find one → record it").
    const known = registryEntryOf(slug)
    if (known === undefined || known.origin !== 'native') {
      upsertRegistryEntry({
        slug,
        name: parsed.name,
        description: parsed.description,
        path: full,
        kind: kind === 'directory' ? 'bundle' : 'file',
        origin: 'native',
        announce: known?.announce ?? true,
        registeredAt: known?.registeredAt ?? new Date().toISOString(),
      })
    }
    items.push({
      name: parsed.name,
      description: parsed.description,
      whenToUse: parsed.whenToUse,
      group: 'native',
      announce: known?.announce ?? true,
      linked: false,
      source,
      level: levelOf(source),
      kind: kind === 'directory' ? 'bundle' : 'file',
      path: kind === 'directory' ? (found?.doc ?? join(full, 'SKILL.md')) : full,
      slug,
    })
  }
}

/**
 * List every skill across the four groups, de-duplicated by path: native
 * roots first, then stored-but-unlinked rows, then registered-but-unlinked
 * rows. Announce flags come from the ledgers; link presence comes from the
 * filesystem cross-checked against the link ledger.
 */
export function listSkills(cwd?: string): SkillSummary[] {
  const seen = new Set<string>()
  const items: SkillSummary[] = []
  for (const target of scanTargets(cwd)) {
    scanRootInto(target.path, target.source, seen, items)
  }

  const store = storeSkillsDir()
  // Stored skills with no link in any scanned root still need a row (so
  // they can be linked or unmigrated). The scan covers linked ones already.
  const linkedSlugs = new Set(items.filter((i) => i.group === 'stored').map((i) => i.slug))
  for (const entry of readStoreIndex().entries) {
    if (linkedSlugs.has(entry.slug)) continue
    const found = parseBundleDocs(join(store, entry.slug))
    if (found === undefined) continue
    if (seen.has(found.doc)) continue
    if (linkedPathOf(entry.slug) !== undefined) continue
    seen.add(found.doc)
    items.push({
      name: found.parsed.name,
      description: found.parsed.description,
      whenToUse: found.parsed.whenToUse,
      group: 'stored',
      announce: entry.announce,
      linked: false,
      source: 'user-dsh',
      level: 'user',
      kind: 'bundle',
      path: found.doc,
      slug: entry.slug,
    })
  }
  // Bundles dropped straight into the store — an agent following the
  // announcement's guidance — get adopted into the manifest on sight.
  const knownSlugs = new Set(readStoreIndex().entries.map((e) => e.slug))
  let stored: string[] = []
  try { stored = readdirSync(store) } catch { /* store not created yet */ }
  for (const slug of stored) {
    if (slug.startsWith('.') || knownSlugs.has(slug)) continue
    const found = parseBundleDocs(join(store, slug))
    if (found === undefined) continue
    upsertEntry({
      slug,
      name: found.parsed.name,
      origin: '',
      announce: false,
      adoptedAt: new Date().toISOString(),
    })
    if (seen.has(found.doc)) continue
    seen.add(found.doc)
    items.push({
      name: found.parsed.name,
      description: found.parsed.description,
      whenToUse: found.parsed.whenToUse,
      group: 'stored',
      announce: false,
      linked: false,
      source: 'user-dsh',
      level: 'user',
      kind: 'bundle',
      path: found.doc,
      slug,
    })
  }
  // Registered-but-unlinked external skills need their rows too.
  const regLinked = new Set(items.filter((i) => i.group === 'registered' && i.linked).map((i) => i.slug))
  for (const entry of readRegistry().entries) {
    if (entry.origin !== 'external' || regLinked.has(entry.slug)) continue
    if (linkedPathOf(entry.slug) !== undefined) continue
    const mdPath = entry.kind === 'bundle'
      ? (admissionDoc(entry.path) ?? join(entry.path, 'SKILL.md'))
      : entry.path
    if (seen.has(mdPath)) continue
    seen.add(mdPath)
    items.push({
      name: entry.name,
      description: entry.description,
      whenToUse: '',
      group: 'registered',
      announce: entry.announce,
      linked: false,
      source: 'user-dsh',
      level: 'user',
      kind: entry.kind,
      path: mdPath,
      slug: entry.slug,
    })
  }

  // dsh-managed roots first (.dsh/skills before .agents/skills), then name.
  const srcRank = (s: SkillSource) => (s === 'user-dsh' || s === 'project-dsh' ? 0 : 1)
  items.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'project' ? -1 : 1
    const d = srcRank(a.source) - srcRank(b.source)
    if (d !== 0) return d
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
  return items
}

/**
 * Read one skill document (body included). Strict frontmatter first; a
 * DESCRIPTION.md-style document falls back to the lenient parse (name from
 * its directory, description from its body).
 */
export function readSkill(path: string): SkillDetail | null {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf8')
  const parsed = parseSkillFile(raw) ?? parseDescriptionFile(raw, basename(dirname(path)))
  return { ...parsed, path }
}

/**
 * Resolve a slug to a runtime `SkillRegistration` for the context engine:
 * looks in the store first, then the external registry, and reads the
 * admission document (SKILL.md or DESCRIPTION.md) body verbatim (no
 * frontmatter rewriting, ever).
 * @returns undefined when the slug is unknown or its copy is gone.
 */
export function resolveRegistration(slug: string): SkillRegistration | undefined {
  const candidates: Array<{ path: string; bundle: boolean }> = []
  if (entryOf(slug) !== undefined) candidates.push({ path: join(storeSkillsDir(), slug), bundle: true })
  const registered = registryEntryOf(slug)
  if (registered !== undefined) candidates.push({ path: registered.path, bundle: registered.kind === 'bundle' })
  for (const candidate of candidates) {
    const parsed = candidate.bundle
      ? parseBundleDocs(candidate.path)?.parsed ?? null
      : (existsSync(candidate.path) ? parseFlatDoc(candidate.path) : null)
    if (parsed === null) continue
    return {
      name: parsed.name,
      description: parsed.description || parsed.name,
      content: parsed.content,
      source: 'runtime',
    }
  }
  return undefined
}

/**
 * Scan an arbitrary directory for importable skills: the root plus two
 * levels of sub-directories, skipping anything bigger than the cap. Every hit
 * is a *registration* candidate — the canonical copy stays in place.
 */
export function scanSkills(dir: string, maxBytes: number, depth: number): ScannedSkill[] {
  if (!existsSync(dir)) throw new Error('directory not found: ' + dir)
  const items: ScannedSkill[] = []
  const seen = new Set<string>()
  const walk = (current: string, level: number): void => {
    let entries: Dirent[] = []
    try { entries = readdirSync(current, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const name = entry.name
      if (!name || name[0] === '.') continue
      const full = join(current, name)
      if (seen.has(full)) continue
      const kind = entryKind(full, entry)
      if (kind === 'directory') {
        const parsed = parseBundleDir(full)
        if (parsed !== undefined) {
          seen.add(full)
          const size = treeSize(full, maxBytes)
          items.push({
            name: parsed.name,
            description: parsed.description,
            sourcePath: full,
            kind: 'bundle',
            oversize: size > maxBytes,
            size,
          })
          continue
        }
        if (level < depth) walk(full, level + 1)
      } else if (kind === 'file' && name.endsWith('.md') && name !== 'SKILL.md' && name !== 'DESCRIPTION.md') {
        const parsed = parseFlatFile(full)
        if (parsed !== undefined) {
          seen.add(full)
          items.push({
            name: parsed.name,
            description: parsed.description,
            sourcePath: full,
            kind: 'file',
            oversize: false,
            size: treeSize(full, maxBytes),
          })
        }
      }
    }
  }
  walk(dir, 0)
  return items
}
