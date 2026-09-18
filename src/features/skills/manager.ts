/**
 * The skills feature's public surface — one object the rest of the plugin
 * (routes, announcement, context engine) talks to.
 *
 * Everything above this file is either a pure helper or a ledger; this is where
 * they compose into the operations the UI actually calls. Keeping the facade
 * thin is the point of the split: each method below should read as one
 * sentence, and the work it delegates to should be findable by name.
 *
 * Identity note: `slug` is the cross-ledger key (store manifest, registry, link
 * ledger all agree on it), while `path` is where the document physically sits.
 * Rows carry both because either may be the only one known.
 * @module
 */

import { readdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { storeSkillsDir } from '../../shared/paths.ts'
import { MAX_SKILL_BYTES, SCAN_DEPTH } from './limits.ts'
import type {
  ScannedSkill, SkillDetail, SkillGroup, SkillSource, SkillSummary,
  SkillLinks, SkillsRegistry, StoreIndex, StoreOperation, StoreStatus, VerifyResult,
} from '../../shared/protocol/index.ts'
import { enableBlocker, listSkills, readSkill, resolveRegistration, scanSkills } from './scanner.ts'
import { readStoreIndex, recoverIndex, writeStoreIndex } from './store-index.ts'
import { readLinks } from './links.ts'
import { readRegistry } from './registry.ts'
import {
  deleteUntrackedLink, linkSkill, relinkSkills, unlinkSkill, verifyLink,
} from './linking.ts'
import { migrateToStore, unmigrate } from './adopt.ts'
import {
  refreshRegistry, registerExternal, unregisterExternal,
} from './registry-ops.ts'
import { migrate, reMigrate, rollbackMigration, storeStatus } from './migration.ts'
import { deleteStored } from './delete.ts'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

/**
 * The skills engine, as the rest of the plugin sees it.
 *
 * A class rather than a module of functions so routes and the announcement can
 * hold one reference and a test can point it at a scratch `$DSH_STORE_ROOT`
 * without touching global state.
 */
export class SkillsManager {
  /** The skills directory (created on demand inside the unified store root). */
  storeDir(): string {
    return storeSkillsDir()
  }

  // ── store manifest ───────────────────────────────────────────────────────

  /** Read the store manifest, rebuilding it from disk when missing or corrupt. */
  readStoreIndex(): StoreIndex {
    return readStoreIndex()
  }

  /** Write the manifest atomically (temp file + rename). */
  writeStoreIndex(index: StoreIndex): void {
    writeStoreIndex(index)
  }

  /** Rebuild the manifest from whatever bundles exist in the store directory. */
  recoverIndex(): StoreIndex {
    return recoverIndex()
  }

  // ── ledgers ──────────────────────────────────────────────────────────────

  /** Read the external-skills registry, tolerating a missing or corrupt file. */
  readRegistry(): SkillsRegistry {
    return readRegistry()
  }

  /** Read the link ledger, tolerating a missing or corrupt file. */
  readLinks(): SkillLinks {
    return readLinks()
  }

  // ── linking ──────────────────────────────────────────────────────────────

  /** Repoint every ledger-tracked link pointing into `from` at `to`. */
  relinkSkills(from: string, to: string): number {
    return relinkSkills(from, to)
  }

  /** Create (or confirm) the link for a stored or registered skill. */
  linkSkill(slug: string): void {
    linkSkill(slug)
  }

  /** Remove the link for a skill (the canonical copy is never touched). */
  unlinkSkill(slug: string): void {
    unlinkSkill(slug)
  }

  /** Verify a link: resolves? target alive? tracked? */
  verifyLink(slugOrPath: string): VerifyResult {
    return verifyLink(slugOrPath)
  }

  /** Delete a link the ledger has no record of. */
  deleteUntrackedLink(linkPath: string): void {
    deleteUntrackedLink(linkPath)
  }

  // ── adoption ─────────────────────────────────────────────────────────────

  /** Move a native skill into the store and link it back. Returns the slug. */
  migrateToStore(sourcePath: string, kind: 'bundle' | 'file', source: SkillSource): string {
    return migrateToStore(sourcePath, kind, source)
  }

  /** Undo a migration. Returns the path the skill went back to. */
  unmigrate(slug: string): string {
    return unmigrate(slug)
  }

  // ── registry ─────────────────────────────────────────────────────────────

  /** Register external skills in place (the canonical copy does not move). */
  registerExternal(items: Array<{ sourcePath: string; kind: 'bundle' | 'file' }>) {
    return registerExternal(items)
  }

  /** Drop a registry entry (and its link, when one exists). */
  unregisterExternal(slug: string): void {
    unregisterExternal(slug)
  }

  /** Traceability pass: does every registered canonical path still exist? */
  refreshRegistry() {
    return refreshRegistry()
  }

  // ── scanning / listing ───────────────────────────────────────────────────

  /** List every skill across the four groups. */
  listSkills(cwd?: string): SkillSummary[] {
    return listSkills(cwd)
  }

  /** Read one skill document (body included). */
  readSkill(path: string): SkillDetail | null {
    return readSkill(path)
  }

  /** Resolve a slug to a runtime registration for the context engine. */
  resolveRegistration(slug: string): SkillRegistration | undefined {
    return resolveRegistration(slug)
  }

  /** Scan a picked directory for import candidates. */
  scanSkills(dir: string): ScannedSkill[] {
    return scanSkills(dir, MAX_SKILL_BYTES, SCAN_DEPTH)
  }

  // ── deletion ─────────────────────────────────────────────────────────────

  /**
   * Delete a **stored** skill by slug (the only delete there is). Throws when
   * the slug is not a bare name or the store holds no such skill.
   */
  deleteStored(slug: string): string {
    return deleteStored(slug)
  }

  /**
   * Why the model may not enable `slug` (a container directory has no body to
   * load), or undefined when the flip may proceed.
   */
  enableBlocker(slug: string): string | undefined {
    return enableBlocker(slug)
  }

  // ── one-shot migration ───────────────────────────────────────────────────

  /** One-shot adoption of user-level native skills into the store. */
  migrate(): StoreOperation {
    return migrate()
  }

  /** Undo {@link migrate}: restore every stored skill to its original path. */
  rollbackMigration(): StoreOperation {
    return rollbackMigration()
  }

  /** Run the one-shot migration again (the uninstall page's undo). */
  reMigrate(): StoreOperation {
    return reMigrate()
  }

  /** Store state for the UI banner. */
  storeStatus(): StoreStatus {
    return storeStatus()
  }
}

/** Re-exported so routes can report a store that has no bundles yet. */
export function storeHasBundles(): boolean {
  const dir = storeSkillsDir()
  if (!existsSync(dir)) return false
  try { return readdirSync(dir).some((n) => !n.startsWith('.')) } catch { return false }
}
