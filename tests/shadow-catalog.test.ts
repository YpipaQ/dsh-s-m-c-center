/**
 * The shadow takeover.
 *
 * dsh stops publishing its catalog the moment `ctx.tools.get('skill', agent)`
 * resolves to anything but its own definition — and an agent-scoped same-name
 * tool is exactly that (asserted by dsh's own spec). What replaces it is ours:
 * a `skill` tool gated on the conversation's selection, and a catalog frame
 * that lists the selection plus the index and nothing else.
 * @module
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SkillSummary } from '../src/shared/protocol/index.ts'
import type { SkillsManager } from '../src/features/skills/index.ts'
import { catalogEntriesOf } from '../src/features/skills/index.ts'
import type { AgentLike } from '../src/features/context/index.ts'
import {
  CATALOG_KIND, buildShadowSkillTool, nextCatalogDecision, renderSmcCatalog,
  smcDigest, writeSelection,
} from '../src/features/context/index.ts'

let home: string
let origHome: string | undefined

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'smc-shadow-home-'))
  origHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  rmSync(home, { recursive: true, force: true })
})

const row = (over: Partial<SkillSummary>): SkillSummary => ({
  name: over.name ?? 'x', description: over.description ?? 'd', group: 'stored',
  linked: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'p',
  slug: over.slug ?? over.name ?? 'x', ...over,
})

describe('catalogEntriesOf', () => {
  it('an empty selection publishes the index and nothing else', () => {
    const entries = catalogEntriesOf([row({ name: 'linked-skill', slug: 'linked-skill' })], [])
    expect(entries).toEqual([expect.objectContaining({ name: 'smc-skill-index' })])
  })

  it('lists exactly the enabled selection, plus the index — never the rest', () => {
    const rows = [
      row({ name: 'picked', description: 'picked skill', slug: 'picked' }),
      row({ name: 'unpicked', description: 'not in this conversation', slug: 'unpicked', linked: false }),
    ]
    const entries = catalogEntriesOf(rows, ['picked'])

    expect(entries.map((entry) => entry.name)).toEqual(['picked', 'smc-skill-index'])
    expect(entries[0]).toEqual({ name: 'picked', description: 'picked skill' })
  })

  it('folds a multi-line description onto one line, capped at 500', () => {
    const entries = catalogEntriesOf(
      [row({ name: 'verbatim', description: '第一行\n\n第二行', slug: 'verbatim' }), row({ name: 'long', description: 'x'.repeat(600), slug: 'long' })],
      ['verbatim', 'long'],
    )
    const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry.description]))
    expect(byName.verbatim).toBe('第一行 第二行')
    expect(byName.long.length).toBe(500)
  })
})

describe('smcDigest', () => {
  it('is stable and order-sensitive', () => {
    const a = [{ name: 'x', description: 'd' }]
    expect(smcDigest(a)).toBe(smcDigest([{ name: 'x', description: 'd' }]))
    expect(smcDigest(a)).not.toBe(smcDigest([{ name: 'x', description: 'e' }]))
  })
})

describe('nextCatalogDecision', () => {
  const entries = [{ name: 'picked', description: 'p' }, { name: 'smc-skill-index', description: 'i' }]
  const asSource = (messages: readonly { id: string; source?: { kind?: string } }[]) => messages

  it('appends the frame on the first publication', () => {
    const next = nextCatalogDecision(asSource([]), entries)
    expect(next).toHaveLength(1)
  })

  it('leaves the list alone when the digest is unchanged', () => {
    const published = renderSmcCatalog(entries, false) as unknown as { id: string; source?: { kind?: string; entries?: typeof entries } }
    const messages = [published]
    expect(nextCatalogDecision(asSource(messages), entries)).toBeUndefined()
  })

  it('replaces in place and announces a replacement when the selection changes', () => {
    const published = renderSmcCatalog(entries, false) as unknown as { id: string; source?: { kind?: string; entries?: typeof entries } }
    const nextEntries = [{ name: 'other', description: 'o' }, { name: 'smc-skill-index', description: 'i' }]
    const next = nextCatalogDecision(asSource([published]), nextEntries)

    expect(next).toHaveLength(1)
    expect(next![0].id).toBe(published.id)
    const source = (next![0] as { source?: { update?: boolean; entries?: typeof nextEntries } }).source
    expect(source?.update).toBe(true)
    expect(source?.entries.map((entry) => entry.name)).toEqual(['other', 'smc-skill-index'])
  })

  it('ignores dsh catalog frames — only our own kind is ours to manage', () => {
    const dshFrame = { id: 'dsh-1', source: { kind: 'skill-catalog', entries } }
    expect(nextCatalogDecision(asSource([dshFrame]), entries)).toHaveLength(2)
  })

  it('the frame declares our own source kind', () => {
    const published = renderSmcCatalog(entries, false) as unknown as { source?: { kind?: string } }
    expect(published.source?.kind).toBe(CATALOG_KIND)
  })
})

describe('shadow skill tool', () => {
  /** A manager that resolves every slug, with two rows to map name → slug. */
  function spyManager(): SkillsManager {
    return {
      listSkills: () => [
        row({ name: 'enabled', description: 'enabled skill', slug: 'enabled' }),
        row({ name: 'other', description: 'other skill', slug: 'other', linked: false }),
      ],
      resolveRegistration: (slug: string) => ({
        name: slug, description: slug + ' skill', content: 'body of ' + slug,
        source: 'runtime', resourceBase: { kind: 'directory', path: '/store/' + slug },
      }),
    } as unknown as SkillsManager
  }

  const agent = (id: string): { agent: AgentLike } => ({
    agent: { id, session: { header: { cwd: home } } } as unknown as AgentLike,
  })

  it('loads a skill the conversation enabled', async () => {
    writeSelection({ sessionId: '_default', selected: ['enabled'], updatedAt: '' })
    const tool = buildShadowSkillTool(spyManager())

    const result = await tool.execute({ name: 'enabled' }, agent('session-1') as never) as { content: string }

    expect(result.content).toBe('body of enabled')
    expect(result.provider).toBe('runtime')
  })

  it('refuses a skill the conversation never enabled, with the way out', async () => {
    writeSelection({ sessionId: '_default', selected: ['enabled'], updatedAt: '' })
    const tool = buildShadowSkillTool(spyManager())

    await expect(tool.execute({ name: 'other' }, agent('session-1') as never)).rejects.toThrow(/not enabled/)
  })

  it('the index loads even with an empty selection', async () => {
    const tool = buildShadowSkillTool(spyManager())

    const result = await tool.execute({ name: 'smc-skill-index' }, agent('session-1') as never) as { name: string }

    expect(result.name).toBe('smc-skill-index')
    expect(existsSync(home)).toBe(true)
  })
})
