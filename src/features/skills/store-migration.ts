/**
 * One-shot migration into the unified store root (`~/.dsh/S-M-C`).
 *
 * Before the unified store the plugin scattered four artefacts across `$DSH_HOME`
 * (`skills-store/`, `mcp.json`, `mcp-archive.json`, `cli.json`). They belong
 * together, so this moves them — once — and leaves the old paths empty.
 *
 * The subtle part is the skills. A junction stores an *absolute* target, so
 * relocating the store invalidates every link that pointed into it: the bundles
 * survive the move but become invisible to the agent, which is worse than an
 * obvious failure. Step (3) therefore walks the skill roots and rebuilds any
 * link whose target sits under the old directory.
 *
 * Best effort throughout: a failure is collected and reported rather than
 * thrown, because the plugin failing to mount is a worse outcome than the
 * store being in a mixed state the status route can show.
 * @module
 */

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { StoreFailure } from '../../shared/protocol/index.ts'
import type { SkillsManager } from './manager.ts'
import { STORE_DIR_NAME } from './limits.ts'
import {
  dshHomeDir, ensureStoreRoot, storeCliPath, storeMcpArchivePath, storeMcpPath,
  storeRoot, storeSkillsDir,
} from '../../shared/paths.ts'
import { movePath } from '../../shared/fs-utils.ts'

/** Result of one migration pass. */
export interface StoreRootMigration {
  /** Human-readable names of what moved (empty when there was nothing old). */
  moved: string[]
  /** Links repointed at the new skills directory. */
  relinked: number
  /** Anything that could not be moved; the old path stays where it is. */
  failures: StoreFailure[]
}

/** Legacy locations, relative to `$DSH_HOME`. */
const LEGACY_SKILLS = STORE_DIR_NAME
const LEGACY_DOCS = ['mcp.json', 'mcp-archive.json', 'cli.json'] as const

/** Move the four legacy artefacts into the unified store root. */
export function migrateStoreRoot(skills: SkillsManager): StoreRootMigration {
  const home = dshHomeDir()
  const result: StoreRootMigration = { moved: [], relinked: 0, failures: [] }

  // (0) The root itself, created even when there is nothing to migrate: the
  //     directory should be visible from the first start — that is the point of
  //     having one — rather than appearing the first time something is written.
  try {
    ensureStoreRoot()
  } catch (e) {
    result.failures.push({ path: storeRoot(), reason: message(e) })
    return result
  }

  // (1) skills-store/ → S-M-C/skills
  const oldSkills = join(home, LEGACY_SKILLS)
  const newSkills = storeSkillsDir()
  const hadOldSkills = existsSync(oldSkills)
  if (hadOldSkills && resolve(oldSkills) !== resolve(newSkills)) {
    try {
      movePath(oldSkills, newSkills)
      result.moved.push(LEGACY_SKILLS + '/')
    } catch (e) {
      result.failures.push({ path: oldSkills, reason: message(e) })
    }
  }

  // (2) the three documents
  const targets: Record<(typeof LEGACY_DOCS)[number], string> = {
    'mcp.json': storeMcpPath(),
    'mcp-archive.json': storeMcpArchivePath(),
    'cli.json': storeCliPath(),
  }
  for (const name of LEGACY_DOCS) {
    const from = join(home, name)
    const to = targets[name]
    if (!existsSync(from)) continue
    if (resolve(from) === resolve(to)) continue
    try {
      movePath(from, to)
      result.moved.push(name)
    } catch (e) {
      result.failures.push({ path: from, reason: message(e) })
    }
  }

  // (3) repoint links — only meaningful if the old store ever existed.
  if (hadOldSkills) {
    try {
      result.relinked = skills.relinkSkills(oldSkills, newSkills)
    } catch (e) {
      result.failures.push({ path: newSkills, reason: message(e) })
    }
  }

  return result
}

function message(e: unknown): string {
  return String((e as Error)?.message ?? e)
}
