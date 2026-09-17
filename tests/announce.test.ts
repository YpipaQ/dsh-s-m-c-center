/**
 * Announcement rendering.
 *
 * The point of the dynamic announcement is that the agent sees real inventory.
 * These tests pin that: a CLI that exists only in the registry must show up by
 * name (it is registered nowhere else), and a throwing manager must degrade to
 * a placeholder rather than breaking the prompt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { invalidateAnnouncement, renderAnnouncement } from '../src/features/announce/index.ts'
import type { CliSummary, McpServerSummary, SkillSummary } from '../src/shared/protocol/index.ts'

let home: string
let origHome: string | undefined

beforeEach(() => {
  // The renderer memoizes on cwd; without this every case would reuse the
  // first one's output.
  invalidateAnnouncement()
  home = join(tmpdir(), 'dsh-announce-' + Math.random().toString(36).slice(2))
  mkdirSync(home, { recursive: true })
  origHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(() => {
  if (origHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = origHome
  rmSync(home, { recursive: true, force: true })
})

/** A minimal skill row. */
function skill(name: string, description = ''): SkillSummary {
  return {
    name, description, whenToUse: '', group: 'native',
    source: 'project-dsh', level: 'project', kind: 'bundle', path: '/x/' + name,
  }
}

/** A minimal MCP row. */
function mcp(
  name: string,
  status: McpServerSummary['status'],
  enabled = true,
  archived = false,
): McpServerSummary {
  return { name, transport: 'stdio', enabled, status, archived }
}

/** A minimal CLI row. */
function cli(name: string, over: Partial<CliSummary> = {}): CliSummary {
  return { name, command: name, source: 'registry', enabled: true, exists: true, ...over }
}

/** Managers returning fixed data. */
function sources(over: {
  skills?: SkillSummary[]
  mcp?: McpServerSummary[]
  cli?: CliSummary[]
  throwSkills?: boolean
} = {}) {
  return {
    skills: {
      listSkills: () => {
        if (over.throwSkills) throw new Error('disk gone')
        return over.skills ?? []
      },
    },
    mcp: { listForUi: () => over.mcp ?? [] },
    cli: { list: () => over.cli ?? [] },
  } as never
}

describe('renderAnnouncement — inventory', () => {
  it('names each provided CLI (the only place they are announced)', () => {
    const text = renderAnnouncement(sources({ cli: [cli('gh'), cli('my-tool')] }))
    expect(text).toContain('gh')
    expect(text).toContain('my-tool')
    expect(text).toContain('本地 CLI 工具')
  })

  it('marks a CLI that is not installed', () => {
    const text = renderAnnouncement(sources({ cli: [cli('gh', { exists: false })] }))
    expect(text).toContain('未找到')
    expect(text).toContain('未在本机找到')
  })

  it('excludes CLIs set to 隐藏', () => {
    const text = renderAnnouncement(sources({
      cli: [cli('gh'), cli('hidden', { enabled: false })],
    }))
    expect(text).toContain('gh')
    expect(text).not.toContain('hidden')
    expect(text).toContain('隐藏')
  })

  it('tells the agent how to invoke a CLI, since no tool is registered', () => {
    const text = renderAnnouncement(sources({ cli: [cli('gh')] }))
    expect(text).toContain('终端')
  })

  it('reports MCP servers with their tool namespace', () => {
    const text = renderAnnouncement(sources({ mcp: [mcp('github', 'running')] }))
    expect(text).toContain('github')
    expect(text).toContain('mcp__github__<tool>')
    expect(text).toContain('已连接')
  })

  it('surfaces a failed MCP connection', () => {
    const text = renderAnnouncement(sources({
      mcp: [mcp('broken', 'failed')],
    }))
    expect(text).toContain('连接失败')
  })

  it('names an archived MCP server as archived rather than omitting it', () => {
    const text = renderAnnouncement(sources({
      mcp: [mcp('github', 'running'), mcp('old', 'stopped', false, true)],
    }))
    expect(text).toContain('github')
    expect(text).toContain('1 个已归档')
    // An archived server must not be advertised as usable.
    expect(text).not.toContain('mcp__old__<tool>')
  })

  it('says every MCP server is archived when none is active', () => {
    const text = renderAnnouncement(sources({
      mcp: [mcp('old', 'stopped', false, true)],
    }))
    expect(text).toContain('全部 1 个已归档')
    expect(text).not.toContain('MCP 服务器：未配置。')
  })

  it('lists every skill with its description', () => {
    const text = renderAnnouncement(sources({
      skills: [skill('commit', 'Write a commit message')],
    }))
    expect(text).toContain('commit')
    expect(text).toContain('Write a commit message')
  })

  // There is no per-skill on/off flag: a skill under a .dsh/skills root is
  // announced by dsh itself, and a store copy becomes loadable through the
  // context selection — so the block lists everything and gates nothing.
  it('lists all skills rather than counting some as hidden', () => {
    const text = renderAnnouncement(sources({
      skills: [skill('one'), skill('two')],
    }))
    expect(text).toContain('共 2 个')
    expect(text).toContain('- one')
    expect(text).toContain('- two')
    expect(text).not.toContain('已隐藏')
  })

  it('says so when everything is empty', () => {
    const text = renderAnnouncement(sources())
    expect(text).toContain('技能：无。')
    expect(text).toContain('MCP 服务器：未配置。')
    expect(text).toContain('本地 CLI 工具：未发现。')
  })
})

describe('renderAnnouncement — resilience', () => {
  it('degrades to a placeholder when a manager throws', () => {
    const text = renderAnnouncement(sources({ throwSkills: true }))
    expect(text).toContain('技能：（读取失败')
    // Other blocks still render; one bad read must not blank the section.
    expect(text).toContain('本地 CLI 工具')
  })

  it('caps a long list instead of dumping it wholesale', () => {
    const many = Array.from({ length: 120 }, (_, i) => cli('tool' + i))
    const text = renderAnnouncement(sources({ cli: many }))
    expect(text).toContain('共 120 个')
    expect(text).not.toContain('tool119')
  })

  it('is memoized across back-to-back calls', () => {
    const s = sources({ cli: [cli('gh')] })
    const a = renderAnnouncement(s)
    const b = renderAnnouncement(s)
    expect(a).toBe(b)
  })
})
