/**
 * Workspace resolution — which directory owns a conversation's data.
 *
 * dsh's own rule is "the nearest `.git` ancestor", and the plugin followed it
 * literally: with no marker to find, the walk went all the way to the volume
 * root. Every conversation in a folder that is not a git repo — a notes tree, a
 * scratch area, an encoded workspace path — then shared one bucket at `G:\` or
 * `C:\`, so unrelated projects saw each other's selections and the workspace
 * that actually owns them looked like it had none.
 */
import { describe, expect, it } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { findProjectRoot } from '../src/features/skills/index.ts'

describe('workspace resolution', () => {
  it('walks up to the nearest .git', () => {
    const root = join(tmpdir(), 'dsh-root-' + Math.random().toString(36).slice(2))
    mkdirSync(join(root, '.git'), { recursive: true })
    mkdirSync(join(root, 'a', 'b'), { recursive: true })

    expect(findProjectRoot(join(root, 'a', 'b'))).toBe(resolve(root))
    rmSync(root, { recursive: true, force: true })
  })

  it('falls back to the starting directory, never the volume root', () => {
    const nested = join(tmpdir(), 'dsh-plain-' + Math.random().toString(36).slice(2), 'deep', 'deeper')
    mkdirSync(nested, { recursive: true })

    const got = findProjectRoot(nested)

    expect(got).toBe(resolve(nested))
    // A volume root is its own parent; landing there is the bug this pins.
    expect(dirname(got)).not.toBe(got)
    rmSync(nested, { recursive: true, force: true })
  })

  it('does not climb past a directory that merely looks like one', () => {
    const base = join(tmpdir(), 'dsh-halfway-' + Math.random().toString(36).slice(2))
    mkdirSync(join(base, '.git'), { recursive: true })
    mkdirSync(join(base, 'inner', 'leaf'), { recursive: true })

    // The inner directory has no marker of its own, so the outer project wins —
    // the fallback must not fire while a real marker is still reachable.
    expect(findProjectRoot(join(base, 'inner', 'leaf'))).toBe(resolve(base))
    rmSync(base, { recursive: true, force: true })
  })
})
