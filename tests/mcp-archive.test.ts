/**
 * MCP archive: moving definitions between ~/.dsh/S-M-C/mcp.json (active) and
 * ~/.dsh/S-M-C/mcp-archive.json (kept, but not connected and not announced).
 *
 * The promise being pinned here is that "not active" has exactly one spelling:
 * an archived definition is *absent* from the active document, not present with
 * a flag on it. That is what makes archiving equivalent to the skill store's
 * unlinked state and to a CLI's 不提供 — and what guarantees the agent never
 * sees a tool from a server the user switched off.
 *
 * Only the document-level methods are exercised; none of them touch the cordis
 * context, so a bare manager is enough (connecting is covered elsewhere).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { McpManager, mcpArchivePath, mcpConfigPath, readMcpArchive, readMcpConfig, writeMcpConfig } from '../src/mcp.ts'
import type { McpServerConfig } from '../src/protocol.ts'

let home: string
let origHome: string | undefined

beforeEach(() => {
  home = join(tmpdir(), 'dsh-mcp-archive-' + Math.random().toString(36).slice(2))
  mkdirSync(home, { recursive: true })
  origHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  rmSync(home, { recursive: true, force: true })
})

/** A stdio server definition, enabled unless told otherwise. */
function stdio(name: string, enabled: boolean | undefined = true): McpServerConfig {
  const s: McpServerConfig = { name, transport: 'stdio', command: 'npx', args: ['-y', name] }
  if (enabled !== undefined) s.enabled = enabled
  return s
}

/** Names in the active document, in file order. */
const activeNames = (): string[] => readMcpConfig().servers.map((s) => s.name)

/** Names in the archive document, in file order. */
const archiveNames = (): string[] => readMcpArchive().servers.map((s) => s.name)

const manager = () => new McpManager({} as Context)

describe('mcp archive documents', () => {
  it('reads as empty when neither document exists', () => {
    expect(readMcpConfig().servers).toEqual([])
    expect(readMcpArchive().servers).toEqual([])
    expect(manager().listForUi()).toEqual([])
  })

  it('reads as empty when the archive is corrupt', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    writeFileSync(mcpArchivePath(), '{ not json', 'utf8')
    expect(readMcpArchive().servers).toEqual([])
    expect(archiveNames()).toEqual([])
  })
})

describe('archiveServer', () => {
  it('removes the definition from the active document', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta')] })
    manager().archiveServer('alpha')
    expect(activeNames()).toEqual(['beta'])
  })

  it('preserves the definition in the archive, marked inactive', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    manager().archiveServer('alpha')
    expect(archiveNames()).toEqual(['alpha'])
    const entry = readMcpArchive().servers[0]
    expect(entry.command).toBe('npx')
    expect(entry.args).toEqual(['-y', 'alpha'])
    expect(entry.enabled).toBe(false)
  })

  it('does not duplicate a name that is already archived', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    m.archiveServer('alpha')
    m.activateServer('alpha')
    m.archiveServer('alpha')
    m.archiveServer('alpha')
    expect(archiveNames()).toEqual(['alpha'])
    expect(activeNames()).toEqual([])
  })

  it('is a no-op for an unknown name', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    m.archiveServer('ghost')
    expect(activeNames()).toEqual(['alpha'])
    expect(existsSync(mcpArchivePath())).toBe(false)
  })
})

describe('activateServer', () => {
  it('moves the definition back into the active document as enabled', () => {
    writeMcpConfig({ servers: [stdio('beta')] })
    const m = manager()
    // Reach the state a user would actually be in: alpha was archived earlier.
    m.saveServer(stdio('alpha'))
    m.archiveServer('alpha')
    expect(archiveNames()).toEqual(['alpha'])

    m.activateServer('alpha')
    expect(activeNames()).toEqual(['beta', 'alpha'])
    expect(archiveNames()).toEqual([])
    expect(readMcpConfig().servers.find((s) => s.name === 'alpha')?.enabled).toBe(true)
  })

  it('does not duplicate a name that is already active', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    m.activateServer('alpha') // not archived at all
    m.activateServer('alpha')
    expect(activeNames()).toEqual(['alpha'])
  })

  it('is a no-op for an unknown name', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    manager().activateServer('ghost')
    expect(activeNames()).toEqual(['alpha'])
  })
})

describe('saveServer', () => {
  it('writes new definitions as active', () => {
    const saved = manager().saveServer(stdio('alpha'))
    expect(saved.enabled).toBe(true)
    expect(activeNames()).toEqual(['alpha'])
    expect(archiveNames()).toEqual([])
  })

  it('pulls a definition out of the archive instead of leaving it there', () => {
    const m = manager()
    m.saveServer(stdio('alpha'))
    m.archiveServer('alpha')
    expect(archiveNames()).toEqual(['alpha'])

    m.saveServer(stdio('alpha'))
    expect(archiveNames()).toEqual([])
    expect(activeNames()).toEqual(['alpha'])
    expect(readMcpConfig().servers[0].enabled).toBe(true)
  })

  it('forces enabled true even when the payload says false', () => {
    const saved = manager().saveServer(stdio('alpha', false))
    expect(saved.enabled).toBe(true)
    expect(readMcpConfig().servers[0].enabled).toBe(true)
  })

  it('normalizes transport-irrelevant fields away', () => {
    const m = manager()
    m.saveServer({ ...stdio('alpha'), url: 'http://leftover' } as McpServerConfig)
    const stored = readMcpConfig().servers[0]
    expect(stored.transport).toBe('stdio')
    expect(stored.command).toBe('npx')
    expect(stored).not.toHaveProperty('url')
  })
})

describe('deleteServer', () => {
  it('removes an active definition', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta')] })
    manager().deleteServer('alpha')
    expect(activeNames()).toEqual(['beta'])
  })

  it('removes an archived definition', () => {
    const m = manager()
    m.saveServer(stdio('alpha'))
    m.archiveServer('alpha')
    m.deleteServer('alpha')
    expect(archiveNames()).toEqual([])
    expect(activeNames()).toEqual([])
  })

  it('is a no-op for an unknown name', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    manager().deleteServer('ghost')
    expect(activeNames()).toEqual(['alpha'])
  })
})

describe('migrateArchive', () => {
  it('moves every disabled definition out of the active document', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta', false), stdio('gamma', false)] })
    const moved = manager().migrateArchive()
    expect(moved).toBe(2)
    expect(activeNames()).toEqual(['alpha'])
    expect(archiveNames().sort()).toEqual(['beta', 'gamma'])
  })

  it('leaves enabled definitions alone', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta')] })
    expect(manager().migrateArchive()).toBe(0)
    expect(activeNames()).toEqual(['alpha', 'beta'])
    expect(archiveNames()).toEqual([])
  })

  it('is idempotent — a second run has nothing left to move', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta', false)] })
    const m = manager()
    expect(m.migrateArchive()).toBe(1)
    expect(m.migrateArchive()).toBe(0)
    expect(archiveNames()).toEqual(['beta'])
  })

  it('folds in a hand-edited disabled definition on a later run', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    expect(m.migrateArchive()).toBe(0)
    // The user edits the file behind our back, old-style.
    writeMcpConfig({ servers: [stdio('alpha'), stdio('delta', false)] })
    expect(m.migrateArchive()).toBe(1)
    expect(archiveNames()).toEqual(['delta'])
    expect(activeNames()).toEqual(['alpha'])
  })

  it('does not clobber an existing archive entry of the same name', () => {
    writeMcpConfig({ servers: [stdio('alpha', false)] })
    writeFileSync(
      mcpArchivePath(),
      JSON.stringify({ version: 1, servers: [{ ...stdio('alpha', false), command: 'custom-binary' }] }),
      'utf8',
    )
    manager().migrateArchive()
    expect(archiveNames()).toEqual(['alpha'])
    expect(readMcpArchive().servers[0].command).toBe('custom-binary')
  })
})

describe('listForUi', () => {
  it('lists active rows first, then archived ones', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta')] })
    const m = manager()
    m.archiveServer('beta')
    const rows = m.listForUi()
    expect(rows.map((s) => s.name)).toEqual(['alpha', 'beta'])
    expect(rows[0].archived).toBe(false)
    expect(rows[1].archived).toBe(true)
  })

  it('reports an archived row as disabled and stopped', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    m.archiveServer('alpha')
    const [row] = m.listForUi()
    expect(row.enabled).toBe(false)
    expect(row.status).toBe('stopped')
    expect(row.archived).toBe(true)
  })

  it('keeps the archived row editable — the definition is still complete', () => {
    writeMcpConfig({ servers: [stdio('alpha')] })
    const m = manager()
    m.archiveServer('alpha')
    const [row] = m.listForUi()
    expect(row.transport).toBe('stdio')
    expect(row.command).toBe('npx')
    expect(row.args).toEqual(['-y', 'alpha'])
  })
})

describe('current', () => {
  it('reports only the active document, so archived servers are never announced', () => {
    writeMcpConfig({ servers: [stdio('alpha'), stdio('beta')] })
    const m = manager()
    m.archiveServer('beta')
    expect(m.current().map((s) => s.name)).toEqual(['alpha'])
  })

  it('returns an empty list when the active document is unreadable', () => {
    mkdirSync(dirname(mcpConfigPath()), { recursive: true })
    writeFileSync(mcpConfigPath(), '{ broken', 'utf8')
    expect(manager().current()).toEqual([])
  })
})

describe('document paths', () => {
  it('honours DSH_HOME for both documents', () => {
    expect(mcpConfigPath()).toBe(join(home, 'S-M-C', 'mcp.json'))
    expect(mcpArchivePath()).toBe(join(home, 'S-M-C', 'mcp-archive.json'))
  })

  it('persists the archive as pretty JSON under version 1', () => {
    const m = manager()
    m.saveServer(stdio('alpha'))
    m.archiveServer('alpha')
    const raw = JSON.parse(readFileSync(mcpArchivePath(), 'utf8'))
    expect(raw.version).toBe(1)
    expect(raw.servers[0].name).toBe('alpha')
  })
})
