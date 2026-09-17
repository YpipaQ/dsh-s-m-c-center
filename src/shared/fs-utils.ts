/**
 * Filesystem primitives shared by every feature: containment tests, link
 * detection, cross-device moves, best-effort tree sizing.
 *
 * These are the operations more than one feature needs. Anything only one
 * feature uses stays next to that feature, so this module does not grow into a
 * junk drawer.
 * @module
 */

import {
  copyFileSync, cpSync, lstatSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, unlinkSync,
} from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

/**
 * Whether `child` sits inside `parent` (or *is* it).
 *
 * Path-prefix comparison alone is wrong — `/a/bc` must not count as inside
 * `/a/b` — so the check appends a separator and compares resolved paths.
 */
export function inside(parent: string, child: string): boolean {
  const p = resolve(parent)
  const c = resolve(child)
  return c === p || c.startsWith(p + sep)
}

/**
 * Whether the path is a symbolic link or a Windows junction.
 *
 * `lstatSync` sees a junction as a link, which is what every caller here wants:
 * the plugin creates junctions on Windows and symlinks elsewhere, and both must
 * read back as "a link".
 */
export function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Absolute target of a link, or undefined when the path is not one (or the
 * target cannot be read).
 *
 * `readlinkSync` returns a relative target when the link was created that way;
 * resolving against the link's own directory makes the result comparable with
 * paths built elsewhere.
 */
export function linkTarget(path: string): string | undefined {
  try {
    const target = readlinkSync(path)
    return resolve(dirname(path), target)
  } catch {
    return undefined
  }
}

/**
 * Whether the path exists, links included and *not* followed.
 *
 * `lstatSync` rather than `statSync` on purpose: callers ask this about paths
 * that may be dangling links, and a dangling link is still an entry to clean up.
 */
export function exists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

/**
 * Move a file or directory, falling back to copy-then-delete across devices.
 *
 * `renameSync` is atomic and cheap but throws EXDEV when source and
 * destination live on different volumes — precisely what happens when the
 * store is relocated to another drive.
 */
export function movePath(from: string, to: string): void {
  try {
    renameSync(from, to)
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'EXDEV') throw e
    if (statSync(from).isDirectory()) {
      cpSync(from, to, { recursive: true })
      rmSync(from, { recursive: true, force: true })
    } else {
      copyFileSync(from, to)
      unlinkSync(from)
    }
  }
}

/**
 * Recursive on-disk size of a directory or file, in bytes.
 *
 * Stops accumulating once `limit` is passed so a pathological tree (or a link
 * loop) cannot make the caller hang: the answer is only ever compared against
 * an import cap, so "bigger than the cap" is as precise as it needs to be.
 * Unreadable entries count as zero rather than throwing.
 */
export function treeSize(path: string, limit = Number.POSITIVE_INFINITY): number {
  let total = 0
  const stack = [path]
  while (stack.length > 0) {
    const current = stack.pop() as string
    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(current)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      let names: string[]
      try {
        names = readdirSync(current)
      } catch {
        continue
      }
      for (const name of names) stack.push(resolve(current, name))
      continue
    }
    total += stat.size
    if (total > limit) return total
  }
  return total
}
