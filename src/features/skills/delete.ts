/**
 * Deleting a stored skill — the **only** delete this plugin performs.
 *
 * The rule is deliberately narrow: the canonical copy under
 * `~/.dsh/S-M-C/skills/<slug>/` is the one thing the plugin owns, so it is the
 * one thing it destroys. A native skill under a skills root is the user's own
 * file, and a registered skill lives in someone else's directory — both are
 * removed by their owner, or by migrating into the store first and deleting it
 * there.
 *
 * An earlier version took an arbitrary path plus a `kind` and `rm -rf`'d
 * `dirname(path)`. That made this route an unvalidated recursive-delete
 * primitive for any process on the machine (and a mis-sent `kind` was enough to
 * delete the wrong directory), so the entry point is now an identity — a store
 * slug — and the path is derived here. Nothing outside the store is ever
 * removed, and a store entry that turns out to be a link is refused rather than
 * followed.
 * @module
 */

import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { admissionDoc } from '../../shared/frontmatter.ts'
import { storeSkillsDir } from '../../shared/paths.ts'
import { inside, isLink } from './roots.ts'
import { removeLink } from './linking.ts'
import { dropEntry } from './store-index.ts'
import { dropRegistryEntry } from './registry.ts'

/** Refusal shared with the route, which answers 400 with it. */
export const ONLY_STORE = '只能删除储存库里的技能：该目标不在储存库内或不是技能'

/**
 * Delete one stored skill: its link, its canonical copy, its manifest entry and
 * any registry record of it.
 * @param slug - the store directory name (a bare name, never a path).
 * @returns the bundle path that was removed.
 * @throws when `slug` is not a bare name, or when the store holds no skill by
 *   that name; the route turns both into a 400.
 */
export function deleteStored(slug: string): string {
  if (slug === '' || slug === '.' || slug === '..' || /[\\/]/.test(slug)) {
    throw new Error('不是有效的技能标识：' + slug)
  }
  const store = storeSkillsDir()
  const bundle = join(store, slug)
  // Belt and braces: without a separator the join cannot escape the store, but
  // this check is what keeps that a property of the code rather than of the
  // caller's string.
  if (!inside(store, bundle)) throw new Error(ONLY_STORE)
  if (!existsSync(bundle)) throw new Error('储存库中没有这个技能：' + slug)
  // A store entry that is itself a link would send rmSync through it and gut
  // whatever it points at.
  if (isLink(bundle)) throw new Error('储存库条目是联接，已拒绝删除：' + slug)
  if (admissionDoc(bundle) === undefined) throw new Error(ONLY_STORE)

  removeLink(slug)
  rmSync(bundle, { recursive: true, force: true })
  dropEntry(slug)
  dropRegistryEntry(slug)
  return bundle
}
