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

/**
 * What a directory with no admission document resolves to when something asks
 * for its body.
 *
 * The row exists so the entry is *visible*, not so it can be loaded: there is
 * no document to load. Saying that in the body beats handing back an empty
 * string (which reads as a broken skill) or a missing file error.
 */
const IRREGULAR_HINT =
  '该目录不是技能：里面既没有 SKILL.md，也没有 DESCRIPTION.md。'
  + 'dsh 只读取技能根目录的一层，所以它不是技能、也无法被加载。'

/**
 * Registry slug for a directory that is not itself a skill.
 *
 * Such a row still needs a stable identity: `resolveCandidate` answers "unknown
 * slug" for anything it cannot look up, which would leave a *displayed* row with
 * no body and no blocker — the two things a user clicks a row to learn. The
 * `dir:` prefix keeps the namespaces apart, because a real skill named `tools`
 * and a category directory named `tools` must not collide on one key: only one
 * of them can be loaded.
 */
function directorySlug(base: string, source: SkillSource): string {
  return 'dir:' + source + ':' + base
}

/** The path a `directorySlug` names, or undefined for an ordinary slug. */
function directorySlugPath(slug: string): string | undefined {
  const parts = /^dir:([^:]+):(.*)$/.exec(slug)
  if (parts === null) return undefined
  const source = parts[1] as SkillSource
  const target = scanTargets().find((t) => t.source === source)
  if (target === undefined) return undefined
  // The base was slugified on the way in, so match on the same transform; a
  // directory whose on-disk name slugs to the same thing is the same row.
  try {
    const hit = readdirSync(target.path).find((name) => slugify(name) === parts[2])
    return hit === undefined ? undefined : join(target.path, hit)
  } catch {
    return undefined
  }
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
 *
 * A root is the agent's territory, so a directory that is *not* an ordinary
 * skill is still shown rather than skipped — but only as what it is. dsh reads
 * exactly one level of a root, so a skill buried under a category directory is
 * unreachable by the agent; listing it would promise reachability that does not
 * exist. Such a directory therefore gets a single flagged row saying it is not
 * a skill. Skipping entries with no admission document — which is what this
 * used to do — turned "the model cannot see my skills" into a silent,
 * undiagnosable state; descending into them turned it into an overstatement.
 */
function scanRootInto(
  dir: string,
  source: SkillSource,
  seen: Set<string>,
  items: SkillSummary[],
): void {
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
    if (parsed === undefined) {
      // Not a skill. A directory is still *shown* — the root is the agent's
      // territory, and an entry the user put there deserves to be accounted
      // for rather than silently skipped. But nothing is descended into: dsh
      // reads exactly one level, so a skill sitting under a category directory
      // is invisible to the agent, and listing it here would only promise a
      // reachability that does not exist. The directory gets one verdict —
      // "this is not a skill" — and the panel flags it.
      //
      // The row carries a slug so the two questions the panel asks of any row
      // (may it be enabled, what is its body) can be answered about it too.
      // Without one it was addressable by path alone, and `enableBlocker`
      // returned "no objection" for something that has no body to load at all.
      if (kind === 'directory') {
        // Marked `seen` like any other row: it is one row for one path, and a
        // second root that happens to hold the same name must not be suppressed
        // by it (the slug carries the root, so the two stay distinct).
        if (seen.has(full)) continue
        seen.add(full)
        items.push({
          name,
          description: '',
          whenToUse: '',
          group: 'native',
          linked: false,
          source,
          level: levelOf(source),
          kind: 'bundle',
          path: full,
          slug: directorySlug(slugify(name), source),
          irregular: 'illegal',
        })
      }
      continue
    }
    if (seen.has(full)) continue
    seen.add(full)
    const slug = slugify(parsed.name)
    // Auto-register so the row has a stable identity ("find one → record it").
    const known = registryEntryOf(slug)
    if (known === undefined || known.origin !== 'native') {
      upsertRegistryEntry({
        slug,
        name: parsed.name,
        description: parsed.description,
        path: full,
        kind: kind === 'directory' ? 'bundle' : 'file',
        origin: 'native',
        registeredAt: known?.registeredAt ?? new Date().toISOString(),
      })
    }
    items.push({
      name: parsed.name,
      description: parsed.description,
      whenToUse: parsed.whenToUse,
      group: 'native',
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
 * rows. Link presence comes from the filesystem cross-checked against the
 * link ledger.
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
      adoptedAt: new Date().toISOString(),
    })
    if (seen.has(found.doc)) continue
    seen.add(found.doc)
    items.push({
      name: found.parsed.name,
      description: found.parsed.description,
      whenToUse: found.parsed.whenToUse,
      group: 'stored',
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
      linked: false,
      // The verdict the last traceability pass recorded, so a row whose source
      // has been renamed or deleted keeps saying so instead of presenting the
      // same 联接 button as a healthy entry.
      missing: entry.missing !== undefined,
      missingReason: entry.missing?.reason,
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
/**
 * Read one skill document (body included). Strict frontmatter first; a
 * DESCRIPTION.md-style document falls back to the lenient parse (name from
 * its directory, description from its body).
 *
 * A *directory* is the one input that has no document to read — the shape a
 * flagged non-skill row takes. Rather than letting `readFileSync` throw (the
 * request would 500 and the panel would show a raw error for a row the user is
 * clicking precisely to understand), it answers with the same explanation the
 * row's own description carries.
 */
export function readSkill(path: string): SkillDetail | null {
  if (!existsSync(path)) return null
  let isDir = false
  try { isDir = statSync(path).isDirectory() } catch { return null }
  if (isDir) {
    return {
      name: basename(path),
      description: IRREGULAR_HINT,
      whenToUse: '',
      content: IRREGULAR_HINT,
      path,
    }
  }
  const raw = readFileSync(path, 'utf8')
  const parsed = parseSkillFile(raw) ?? parseDescriptionFile(raw, basename(dirname(path)))
  return { ...parsed, path }
}

/**
 * What one slug resolves to, plus the admission document that admitted it —
 * the document decides whether the thing is a real skill or a container.
 */
interface ResolvedCandidate {
  registration: SkillRegistration
  /**
   * `SKILL.md` / `DESCRIPTION.md` for bundles, `file` for a flat document, and
   * `missing` for a directory that carries neither — the shape a non-skill row
   * takes when a root is showing one anyway.
   */
  admission: 'SKILL.md' | 'DESCRIPTION.md' | 'file' | 'missing'
}

/**
 * Resolve one slug to its registration.
 *
 * A bundle with no admission document is still *resolvable* — it returns a
 * placeholder whose body explains that there is nothing to load — because
 * `resolveRegistration` is also what the panel asks for when it opens a row,
 * and answering "unknown slug" there would leave a displayed row with no detail
 * at all. Refusing it stays `enableBlocker`'s job: a blocker is a *reason*, and
 * returning undefined here would read as "no objection".
 */
function resolveCandidate(slug: string): ResolvedCandidate | undefined {
  const candidates: Array<{ path: string; bundle: boolean }> = []
  if (entryOf(slug) !== undefined) candidates.push({ path: join(storeSkillsDir(), slug), bundle: true })
  const registered = registryEntryOf(slug)
  if (registered !== undefined) candidates.push({ path: registered.path, bundle: registered.kind === 'bundle' })
  // A non-skill directory row is not a skill, so it is never written to a
  // ledger — the slug itself carries the root it was found in, which is enough
  // to read it back. Without this the row would be listed with no detail and no
  // blocker, the two things a user clicks a row to learn.
  const dirPath = directorySlugPath(slug)
  if (dirPath !== undefined) candidates.push({ path: dirPath, bundle: true })
  for (const candidate of candidates) {
    if (candidate.bundle) {
      const found = parseBundleDocs(candidate.path)
      if (found === undefined) {
        // A directory with neither document: not a skill, but a row the panel
        // may be showing, so it still resolves — to an explanation.
        if (!existsSync(candidate.path)) continue
        return {
          registration: {
            name: basename(candidate.path),
            description: IRREGULAR_HINT,
            content: IRREGULAR_HINT,
            source: 'runtime',
            resourceBase: { kind: 'directory', path: candidate.path },
          },
          admission: 'missing',
        }
      }
      return {
        registration: {
          name: found.parsed.name,
          description: found.parsed.description || found.parsed.name,
          content: found.parsed.content,
          source: 'runtime',
          // Where the skill's own files live. Without it dsh tells the model
          // that resources are "managed by provider" and gives it no path, so a
          // skill whose real content sits in `references/` loses that half of
          // itself the moment it is enabled.
          resourceBase: { kind: 'directory', path: candidate.path },
        },
        // Case-insensitive on purpose: the value is a file name off disk, and
        // upper-casing it before the comparison (as this line once did) can
        // never equal `DESCRIPTION.md` — which silently turned every container
        // into a "real skill" and made `enableBlocker` a no-op.
        admission: basename(found.doc).toLowerCase() === 'description.md' ? 'DESCRIPTION.md' : 'SKILL.md',
      }
    }
    if (!existsSync(candidate.path)) continue
    const parsed = parseFlatDoc(candidate.path)
    if (parsed === null) continue
    return {
      registration: {
        name: parsed.name,
        description: parsed.description || parsed.name,
        content: parsed.content,
        source: 'runtime',
        // A flat file's siblings (if any) sit beside it, not at the file.
        resourceBase: { kind: 'directory', path: dirname(candidate.path) },
      },
      admission: 'file',
    }
  }
  return undefined
}

/**
 * Resolve a slug to a runtime `SkillRegistration` for the context engine:
 * looks in the store first, then the external registry, and reads the
 * admission document (SKILL.md or DESCRIPTION.md) body verbatim (no
 * frontmatter rewriting, ever).
 *
 * A row that carries **no** admission document is refused here even though
 * {@link resolveCandidate} can describe it. That description exists so the panel
 * can answer "why is this row red?" when a user clicks it, and a description is
 * not a body: this function is the *loading* path (the context engine and
 * `skill_select` both call it), and handing back the explanation there installed
 * a non-skill into a conversation — the panel said "not loadable" while the
 * model's catalog listed it as loadable, and the slug was written into the
 * conversation's selection file where no cleanup would ever remove it. The two
 * questions are different questions and now get different answers.
 *
 * @returns undefined when the slug is unknown, its copy is gone, or it is a
 * directory with nothing to load.
 */
export function resolveRegistration(slug: string): SkillRegistration | undefined {
  const found = resolveCandidate(slug)
  if (found === undefined || found.admission === 'missing') return undefined
  return found.registration
}

/**
 * Why the model may not enable `slug`, or undefined when it may.
 *
 * A directory admitted by `DESCRIPTION.md` alone is a *container*: it lists in
 * the panel and migrates into the store, but it has no body to load. Letting a
 * flip accept it produced a dead line in the model's catalog.
 *
 * A directory with *no* admission document at all is worse — there is not even
 * a body to show. It is not a skill at all, and dsh would not see anything in
 * it either, so it is refused with the reason said plainly rather than a flip
 * that appears to do nothing.
 */
export function enableBlocker(slug: string): string | undefined {
  const found = resolveCandidate(slug)
  if (found === undefined) return undefined
  if (found.admission === 'DESCRIPTION.md') {
    return '该条目是容器目录（只有 DESCRIPTION.md，没有可加载的正文）；请启用它下面的具体技能'
  }
  if (found.admission === 'missing') {
    return '该条目不是合法技能：目录里没有 SKILL.md 或 DESCRIPTION.md，无法加载'
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
