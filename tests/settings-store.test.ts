/**
 * The store-hosted settings document (`$STORE_ROOT/settings.json`).
 *
 * dsh 0.1.7 archives `~/.dsh/settings.yaml` on upgrade and with it every
 * third-party block — a restart used to reset this plugin to its defaults.
 * These tests pin the replacement arrangement: the settings live in the store,
 * the one-shot migration carries the old YAML block over exactly once (live
 * file first, then the 0.1.7 archive; current namespace before the legacy
 * one), and nothing ever writes into dsh's settings.yaml again.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  migrateSettingsIntoStore, readSettings, writeSettings,
} from '../src/features/settings/index.ts'
import { storeRoot, storeSettingsPath } from '../src/shared/paths.ts'

let home: string
let origHome: string | undefined
let origRoot: string | undefined

beforeEach(() => {
  const id = Math.random().toString(36).slice(2)
  home = join(tmpdir(), 'dsh-smc-settings-' + id)
  mkdirSync(home, { recursive: true })
  origHome = process.env.DSH_HOME
  origRoot = process.env.DSH_STORE_ROOT
  process.env.DSH_HOME = home
  delete process.env.DSH_STORE_ROOT
})

afterEach(() => {
  for (const [key, value] of [
    ['DSH_HOME', origHome], ['DSH_STORE_ROOT', origRoot],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  rmSync(home, { recursive: true, force: true })
})

/** The old YAML block, as the plugin itself used to write it. */
function yamlBlock(namespace: string, enabled: string, announce: string): string {
  return ['# dsh settings', namespace + ':', '  enabled: ' + enabled, '  announceToAgent: ' + announce, ''].join('\n')
}

describe('store settings path', () => {
  it('sits inside the store and follows $DSH_STORE_ROOT', () => {
    expect(storeSettingsPath()).toBe(join(home, 'S-M-C', 'settings.json'))
    process.env.DSH_STORE_ROOT = join(home, 'elsewhere')
    expect(storeSettingsPath()).toBe(join(home, 'elsewhere', 'settings.json'))
  })
})

describe('readSettings', () => {
  it('returns the defaults without touching the disk on a fresh machine', () => {
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
    expect(existsSync(storeSettingsPath())).toBe(false)
  })

  it('returns the defaults when the document is corrupt', () => {
    mkdirSync(storeRoot(), { recursive: true })
    writeFileSync(storeSettingsPath(), '{not json', 'utf8')
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
  })
})

describe('writeSettings / readSettings round trip', () => {
  it('persists both switches and creates the store when missing', () => {
    expect(writeSettings({ enabled: false, announceToAgent: false })).toBe(storeSettingsPath())
    expect(existsSync(storeRoot())).toBe(true)
    expect(readSettings()).toEqual({ enabled: false, announceToAgent: false })

    writeSettings({ enabled: true, announceToAgent: false })
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: false })
  })

  it('normalizes absent fields to true rather than failing', () => {
    mkdirSync(storeRoot(), { recursive: true })
    writeFileSync(storeSettingsPath(), '{}', 'utf8')
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
  })
})

describe('migrateSettingsIntoStore', () => {
  it('carries the dsh settings.yaml block over, byte values intact', () => {
    writeFileSync(join(home, 'settings.yaml'), yamlBlock('dsh-s-m-c-center', 'false', 'false'), 'utf8')

    expect(migrateSettingsIntoStore()).toBe(true)
    expect(readSettings()).toEqual({ enabled: false, announceToAgent: false })
    // The legacy document is left in place — dsh still owns it.
    expect(existsSync(join(home, 'settings.yaml'))).toBe(true)
  })

  it('picks up the pre-rename skills-mcp-manager block too', () => {
    writeFileSync(join(home, 'settings.yaml'), yamlBlock('skills-mcp-manager', 'true', 'false'), 'utf8')

    expect(migrateSettingsIntoStore()).toBe(true)
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: false })
  })

  it('falls back to the 0.1.7 archive when the live file is gone', () => {
    writeFileSync(join(home, 'settings.yaml.imported'), yamlBlock('dsh-s-m-c-center', 'false', 'true'), 'utf8')

    expect(migrateSettingsIntoStore()).toBe(true)
    expect(readSettings()).toEqual({ enabled: false, announceToAgent: true })
  })

  it('prefers the live file over the archive', () => {
    writeFileSync(join(home, 'settings.yaml'), yamlBlock('dsh-s-m-c-center', 'false', 'false'), 'utf8')
    writeFileSync(join(home, 'settings.yaml.imported'), yamlBlock('dsh-s-m-c-center', 'true', 'true'), 'utf8')

    migrateSettingsIntoStore()
    expect(readSettings()).toEqual({ enabled: false, announceToAgent: false })
  })

  it('prefers the current namespace over the legacy one in one document', () => {
    writeFileSync(join(home, 'settings.yaml'), [
      'skills-mcp-manager:', '  enabled: false', '  announceToAgent: false', '',
      'dsh-s-m-c-center:', '  enabled: true', '  announceToAgent: true', '',
    ].join('\n'), 'utf8')

    migrateSettingsIntoStore()
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
  })

  it('writes the defaults when no legacy block exists anywhere', () => {
    expect(migrateSettingsIntoStore()).toBe(true)
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
    expect(existsSync(storeSettingsPath())).toBe(true)
  })

  it('is idempotent — an existing store document always wins', () => {
    mkdirSync(storeRoot(), { recursive: true })
    writeSettings({ enabled: false, announceToAgent: true })
    // A "newer" yaml block shows up afterwards; it must be ignored.
    writeFileSync(join(home, 'settings.yaml'), yamlBlock('dsh-s-m-c-center', 'true', 'true'), 'utf8')

    expect(migrateSettingsIntoStore()).toBe(false)
    expect(readSettings()).toEqual({ enabled: false, announceToAgent: true })
  })

  it('survives a corrupt legacy document and still writes the defaults', () => {
    writeFileSync(join(home, 'settings.yaml'), '\u0000\u0001binary garbage', 'utf8')
    expect(migrateSettingsIntoStore()).toBe(true)
    expect(readSettings()).toEqual({ enabled: true, announceToAgent: true })
  })
})
