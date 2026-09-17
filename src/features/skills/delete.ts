/**
 * Deleting a skill, wherever it lives.
 *
 * Three destinations, three different meanings of "delete" — which is the
 * whole reason this is one function rather than three call sites:
 *
 * - **native** — the real file/directory goes. This is the only irreversible
 *   operation in the plugin.
 * - **stored** — the link, its ledger record, the manifest entry and the store
 *   copy all go.
 * - **registered** — the link and the record go; the external canonical copy
 *   is left alone, because the plugin never owned it.
 *
 * The path may arrive as a link's target rather than the link itself, so the
 * first branch identifies the skill by link target and never follows the path:
 * an `rm -rf` through a junction would gut the store copy behind it.
 * @module
 */

import { existsSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { slugify } from '../../shared/frontmatter.ts'
import { storeSkillsDir } from '../../shared/paths.ts'
import { inside, isLink, linkTarget } from './roots.ts'
import { removeLink } from './linking.ts'
import { dropEntry } from './store-index.ts'
import { dropRegistryEntry, readRegistry } from './registry.ts'

/**
 * Delete a skill wherever it lives.
 * @returns the path that was removed (or the link that was removed for a
 *   registered skill — the canonical copy survives).
 */
export function deleteSkill(path: string, kind: 'bundle' | 'file'): string {
  const store = storeSkillsDir()

  // Reached through a link: identify the skill by the link target, never by
  // following the path (a rmSync past a junction would gut the store copy).
  const link = dirname(path)
  if (isLink(link)) {
    const target = linkTarget(link)
    const resolved = target === undefined ? undefined : resolve(link, target)
    const slug = basename(link)
    removeLink(slug)
    if (resolved !== undefined && inside(store, resolved)) {
      const bundle = join(store, slug)
      if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, { recursive: true, force: true })
      dropEntry(slug)
      return bundle
    }
    const reg = resolved === undefined
      ? undefined
      : readRegistry().entries.find((e) => inside(resolve(e.path), resolved))
    if (reg !== undefined) dropRegistryEntry(reg.slug)
    return link
  }

  // Stored: the SKILL.md path sits inside the store directory itself.
  if (inside(store, path)) {
    const slug = basename(dirname(path))
    removeLink(slug)
    const bundle = join(store, slug)
    if (existsSync(bundle) && !isLink(bundle)) rmSync(bundle, { recursive: true, force: true })
    dropEntry(slug)
    dropRegistryEntry(slug)
    return bundle
  }

  // Registered external: the link (if any) and the record go; the files stay.
  const reg = readRegistry().entries.find((e) =>
    resolve(e.path).toLowerCase() === resolve(dirname(path)).toLowerCase()
    || resolve(path).toLowerCase() === resolve(e.path).toLowerCase(),
  )
  if (reg !== undefined) {
    removeLink(reg.slug)
    dropRegistryEntry(reg.slug)
    return reg.path
  }

  // Native: delete the real thing (no link involved at this point).
  const target = kind === 'bundle' ? dirname(path) : path
  const slug = slugify(basename(target))
  removeLink(slug)
  dropRegistryEntry(slug)
  rmSync(target, { recursive: true, force: true })
  return target
}
