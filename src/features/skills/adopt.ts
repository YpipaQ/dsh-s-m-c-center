/**
 * Adoption: moving a native skill into the store (and undoing it).
 *
 * This is the only flow that relocates a user's files, so the rules are strict:
 * the SKILL.md is copied verbatim — never rewritten, not even the frontmatter —
 * a link is left in the original's place so the agent keeps seeing the skill,
 * and the origin is recorded so the whole thing can be undone.
 *
 * Adoption is reserved for user-level skills. A project skill belongs to its
 * repository and is never moved.
 * @module
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import {
  parseBundleDocs, parseSkillFile, slugify, uniqueSlug,
} from '../../shared/frontmatter.ts'
import { movePath } from '../../shared/fs-utils.ts'
import type { SkillSource } from '../../shared/protocol/index.ts'
import { storeSkillsDir } from '../../shared/paths.ts'
import { childNames } from './roots.ts'
import { createLink, removeLink } from './linking.ts'
import { dropEntry, entryOf, upsertEntry } from './store-index.ts'
import { dropRegistryEntry, upsertRegistryEntry } from './registry.ts'

/**
 * Move one native skill into the store, link it back from
 * `~/.dsh/skills/<slug>`, record the link, and drop its registry entry (the
 * skill is a stored one now). The SKILL.md is copied verbatim — no frontmatter
 * rewriting, ever.
 *
 * `source` names the root the skill came from and is carried for the caller's
 * own bookkeeping; the manifest records the path, which is what an unmigrate
 * needs.
 * @returns the store slug.
 */
export function migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string {
  void source
  const store = storeSkillsDir()
  mkdirSync(store, { recursive: true })
  const parsed = kind === 'bundle'
    ? parseBundleDocs(sourcePath)?.parsed ?? null
    : parseSkillFile(readFileSync(sourcePath, 'utf8'))
  if (parsed === null) throw new Error('不是有效的技能文件：' + sourcePath)
  const taken = new Set<string>(childNames(store))
  const slug = uniqueSlug(taken, slugify(parsed.name || basename(sourcePath, extname(sourcePath))))
  const dest = join(store, slug)

  if (kind === 'bundle') movePath(sourcePath, dest)
  else {
    mkdirSync(dest, { recursive: true })
    movePath(sourcePath, join(dest, 'SKILL.md'))
  }

  const nameSlug = slugify(parsed.name)
  dropRegistryEntry(slug)
  dropRegistryEntry(nameSlug)

  createLink(slug, dest)
  upsertEntry({
    slug,
    name: parsed.name,
    origin: sourcePath,
    adoptedAt: new Date().toISOString(),
  })
  return slug
}

/**
 * Undo a migration: remove the link, move the canonical copy back to its
 * origin, and drop the manifest entry. The registry entry is restored so the
 * skill keeps its identity after the round trip.
 * @returns the path the skill was restored to.
 */
export function unmigrate(slug: string): string {
  const entry = entryOf(slug)
  if (entry === undefined) throw new Error('储存库中没有这个技能：' + slug)
  const bundle = join(storeSkillsDir(), slug)
  if (!existsSync(bundle)) throw new Error('储存库副本已不存在：' + bundle)
  if (entry.origin === '') throw new Error('缺少原始路径，无法撤销迁移：' + slug)

  const asFile = extname(entry.origin).toLowerCase() === '.md'
  removeLink(slug)
  mkdirSync(dirname(entry.origin), { recursive: true })
  if (asFile) {
    movePath(join(bundle, 'SKILL.md'), entry.origin)
    rmSync(bundle, { recursive: true, force: true })
  } else {
    movePath(bundle, entry.origin)
  }
  dropEntry(slug)
  upsertRegistryEntry({
    slug,
    name: entry.name,
    description: '',
    path: entry.origin,
    kind: asFile ? 'file' : 'bundle',
    origin: 'native',
    registeredAt: new Date().toISOString(),
  })
  return entry.origin
}
