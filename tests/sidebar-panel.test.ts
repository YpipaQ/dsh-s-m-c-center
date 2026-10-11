// @vitest-environment jsdom
/**
 * The conversation-skills window, driven the way a user drives it.
 *
 * The window is imperative DOM appended to `document.body`, so these cases talk
 * to it through real events rather than through a component harness: a
 * `pointerdown` on the document is exactly what closes it in the browser, and
 * dispatching anything else would test a rule the app does not run.
 *
 * Two environment facts shape the fixtures. jsdom has neither `PointerEvent`
 * nor `ResizeObserver`, so the dismissal cases dispatch a plain bubbling
 * `Event('pointerdown')` (the handler only reads `target`) and the observer is
 * stubbed. And `requestAnimationFrame` is made synchronous, because the window
 * does its first placement in one and every assertion about position and
 * geometry would otherwise be a race.
 *
 * The window's own poll is a self-rescheduling timeout, so the cases advance
 * fake timers instead of sleeping — and `advanceTimersByTimeAsync` is used
 * rather than the sync variant, because each round awaits a fetch first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SMC_API } from '../src/shared/protocol/index.ts'
import { zh } from '../src/client/shared/locales.ts'
import type { SkillsMcpKey } from '../src/client/shared/locales.ts'
import {
  closePanel, isPanelOpen, mountConversationPanel, openPanel, subscribePanel,
} from '../src/client/shell/sidebar.ts'

const t = (key: SkillsMcpKey): string => zh[key]

/** The conversation the fake page claims to be showing. */
const SESSION = 'abcdef1234567890'
const BOX_KEY = 'dsh-s-m-c-center.panel.box'

type Row = {
  name: string; description: string; group: string; slug: string
  path: string; kind: 'file'; level: string; linked: boolean
}

/** One selectable skill, shaped like the Host's `/skills` items. */
function skill(slug: string, name: string, description: string): Row {
  return { name, description, group: 'g', slug, path: `/store/${slug}`, kind: 'file', level: 'user', linked: true }
}

/** A JSON response good enough for the window's `api()` helper. */
function reply(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

let skills: Row[]
let selection: { selected: string[]; configured: boolean }
let table: string
let fetchMock: ReturnType<typeof vi.fn>
let anchor: HTMLButtonElement
let mounted: (() => void) | undefined

/** Open the window and let its first round settle. @returns the panel element. */
async function open(): Promise<HTMLElement> {
  openPanel(anchor, t)
  await vi.advanceTimersByTimeAsync(0)
  const panel = document.getElementById('smc-fp')
  if (panel === null) throw new Error('the window did not open')
  return panel
}

/** A bubbling pointerdown, which is what the dismissal rule listens for. */
function pointerDown(target: EventTarget): void {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', (): void => {})

  document.head.innerHTML = ''
  document.body.innerHTML = ''
  localStorage.clear()
  sessionStorage.clear()
  document.title = 'A conversation \u2014 DeepSeek Harness'
  localStorage.setItem('dsh.sessions.current', JSON.stringify({ sessionId: SESSION }))

  skills = [skill('alpha', 'Alpha', 'first'), skill('beta', 'Beta', 'second')]
  selection = { selected: [], configured: false }
  table = '/home/u/.dsh/S-M-C/contexts.json'

  fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url === SMC_API.skills) return reply({ ok: true, items: skills })
    if (url === SMC_API.contextsGet) return reply({ ok: true, table, selection })
    if (url === SMC_API.contextsToggle) return reply({ ok: true, selection, applied: true })
    if (url === SMC_API.contextsReset) return reply({ ok: true, selection })
    throw new Error(`unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)

  anchor = document.createElement('button')
  document.body.appendChild(anchor)
  mounted = mountConversationPanel()
})

afterEach(() => {
  closePanel()
  mounted?.()
  mounted = undefined
  Reflect.deleteProperty(document, 'hidden')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the window itself', () => {
  it('opens onto document.body, clear of the sidebar that clips overflow', async () => {
    const panel = await open()

    expect(panel.parentElement).toBe(document.body)
    expect(panel.className).toContain('smc-fp')
  })

  it('defaults to the size of the shell\'s other status window, still resizable', () => {
    const css = document.getElementById('dsh-s-m-c-sidebar-style')?.textContent ?? ''

    expect(css).toContain('width:330px')
    expect(css).toContain('height:500px')
    // Pinning is not what holds the window still — the corner handle stays.
    expect(css).toContain('resize:both')
  })

  it('comes back where the user left it', async () => {
    localStorage.setItem(BOX_KEY, JSON.stringify({ left: 40, top: 50, width: 400, height: 300 }))

    const panel = await open()

    expect(panel.style.width).toBe('400px')
    expect(panel.style.height).toBe('300px')
  })

  it('captions the conversation but no longer echoes its id', async () => {
    const panel = await open()

    // The id line was the one piece of the header that told the user nothing.
    expect(panel.textContent).not.toContain(SESSION.slice(0, 8))
    expect(panel.querySelector('.smc-fp-sub')?.children).toHaveLength(1)
    expect(panel.querySelector('.smc-fp-sub .t')?.textContent).toBe('A conversation')
  })

  it('replaces the refresh button with a pin', async () => {
    const panel = await open()
    const pin = panel.querySelector('.smc-fp-pin')

    // Refreshing is the window's own job now, so the seat it occupied is free.
    expect(panel.textContent).not.toContain('\u5237\u65b0')
    expect(pin?.getAttribute('aria-label')).toBe(zh.panelPin)
    expect(pin?.getAttribute('aria-pressed')).toBe('false')
  })

  it('marks itself pinned, and says how to undo it', async () => {
    const panel = await open()
    const pin = panel.querySelector('.smc-fp-pin') as HTMLButtonElement

    pin.click()

    expect(pin.getAttribute('aria-pressed')).toBe('true')
    expect(pin.getAttribute('aria-label')).toBe(zh.panelUnpin)

    pin.click()

    expect(pin.getAttribute('aria-pressed')).toBe('false')
    expect(pin.getAttribute('aria-label')).toBe(zh.panelPin)
  })
})

describe('dismissal', () => {
  it('closes on a pointerdown outside it', async () => {
    await open()

    pointerDown(document.body)

    expect(isPanelOpen()).toBe(false)
  })

  it('stays open when the pointerdown lands inside it', async () => {
    const panel = await open()

    pointerDown(panel.querySelector('.smc-fp-body') as HTMLElement)

    expect(isPanelOpen()).toBe(true)
  })

  it('stays open when the pointerdown lands on the entry', async () => {
    await open()

    // Pressing the entry must not close here and reopen on click: that flicker
    // would also throw away the geometry the user had dragged into place.
    pointerDown(anchor)

    expect(isPanelOpen()).toBe(true)
  })

  it('ignores outside pointerdowns while pinned, and honours them once unpinned', async () => {
    const panel = await open()
    const pin = panel.querySelector('.smc-fp-pin') as HTMLButtonElement

    pin.click()
    pointerDown(document.body)
    expect(isPanelOpen()).toBe(true)

    pin.click()
    pointerDown(document.body)
    expect(isPanelOpen()).toBe(false)
  })

  it('tells subscribers about both transitions', async () => {
    const seen: boolean[] = []
    const unsubscribe = subscribePanel(() => { seen.push(isPanelOpen()) })

    await open()
    closePanel()
    unsubscribe()

    expect(seen).toEqual([true, false])
  })
})

describe('the silent refresh', () => {
  it('leaves the body alone when nothing changed', async () => {
    const panel = await open()
    const first = panel.querySelector('.smc-fp-body')?.firstElementChild

    await vi.advanceTimersByTimeAsync(2500)

    expect(panel.querySelector('.smc-fp-body')?.firstElementChild).toBe(first)
  })

  it('redraws when a skill changes', async () => {
    const panel = await open()

    skills = [skill('alpha', 'Alpha', 'rewritten'), skill('beta', 'Beta', 'second')]
    await vi.advanceTimersByTimeAsync(1200)

    expect(panel.querySelector('.smc-fp-body')?.textContent).toContain('rewritten')
  })

  it('follows a rename within a second', async () => {
    const panel = await open()

    document.title = 'Renamed \u2014 DeepSeek Harness'
    await vi.advanceTimersByTimeAsync(1200)

    expect(panel.querySelector('.smc-fp-sub .t')?.textContent).toBe('Renamed')
  })

  it('follows a conversation switch instead of showing the old one', async () => {
    const panel = await open()

    localStorage.setItem('dsh.sessions.current', JSON.stringify({ sessionId: 'ffffffff99999999' }))
    await vi.advanceTimersByTimeAsync(1200)

    expect(fetchMock.mock.calls.filter(([url]) => String(url) === SMC_API.contextsGet).length).toBeGreaterThan(1)
  })

  it('stops talking while the tab is hidden, and resumes on return', async () => {
    await open()
    const before = fetchMock.mock.calls.length

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock.mock.calls.length).toBe(before)

    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before)
  })

  it('does not stamp over a checkbox whose write is still in flight', async () => {
    let release: (() => void) | undefined
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input)
      if (url === SMC_API.skills) return reply({ ok: true, items: skills })
      if (url === SMC_API.contextsGet) return reply({ ok: true, table, selection })
      if (url === SMC_API.contextsToggle) {
        await new Promise<void>((resolve) => { release = resolve })
        selection = { selected: ['alpha'], configured: true }
        return reply({ ok: true, selection, applied: true })
      }
      throw new Error(`unexpected request: ${url}`)
    })

    const panel = await open()
    const box = panel.querySelector('input[type="checkbox"]') as HTMLInputElement

    box.click()
    await vi.advanceTimersByTimeAsync(3000)

    // The round was skipped outright, so the server's older selection could not
    // land on the box the user had just ticked.
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)

    release?.()
    await vi.advanceTimersByTimeAsync(0)

    // The settled write re-reads rather than trusting the optimistic redraw,
    // so the box in the document is a fresh one — enabled, and reconciled.
    const settled = panel.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(settled.disabled).toBe(false)
    expect(settled.checked).toBe(true)
  })

  it('reports a failed round in the body and keeps polling', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input)
      if (url === SMC_API.skills) throw new Error('offline')
      if (url === SMC_API.contextsGet) return reply({ ok: true, table, selection })
      throw new Error(`unexpected request: ${url}`)
    })

    const panel = await open()
    const before = fetchMock.mock.calls.length

    // A failed round backs off before retrying, so this has to clear the first
    // delay (1s doubled once) rather than one poll period.
    await vi.advanceTimersByTimeAsync(2100)

    expect(panel.querySelector('.smc-fp-body')?.textContent).toContain('offline')
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before)
  })
})

describe('teardown', () => {
  it('stops polling and unlistens once closed', async () => {
    const removed = vi.spyOn(document, 'removeEventListener')

    await open()
    closePanel()
    const after = fetchMock.mock.calls.length

    await vi.advanceTimersByTimeAsync(10_000)
    pointerDown(document.body)

    expect(fetchMock.mock.calls.length).toBe(after)
    expect(removed).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    removed.mockRestore()
  })

  it('takes the stylesheet with it when the plugin unloads', async () => {
    expect(document.getElementById('dsh-s-m-c-sidebar-style')).not.toBeNull()

    mounted?.()
    mounted = undefined

    expect(document.getElementById('dsh-s-m-c-sidebar-style')).toBeNull()
    expect(isPanelOpen()).toBe(false)
  })
})
