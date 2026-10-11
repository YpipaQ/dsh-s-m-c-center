/**
 * The conversation-skills window: a floating panel, and only that.
 *
 * The sidebar *entry* that opens it is a slot occupant built elsewhere
 * (`SidebarEntry.tsx`) — the shell owns that button now. What is left here is
 * the window itself, which is deliberately imperative DOM on `document.body`:
 * it must outlive any React tree, survive shell re-renders, and be dragged and
 * resized like a desktop window. Hanging it inside the sidebar was never an
 * option — the sidebar clips overflow (the shell's own footer panel works
 * around it by measuring an anchor), so a `position: fixed` child there would
 * be cut off at the column edge.
 *
 * The window is a *window*, not a docked popover: dragged by its header and
 * resized from its corner, both remembered. A position is chosen for it only
 * the first time — after that the user's word is final.
 *
 * **It keeps itself current.** Once a second it re-reads which conversation you
 * are in and re-fetches the list, then redraws *only if a fingerprint of the
 * whole result moved*. That is what makes switching conversations and renaming
 * one follow within a second — a job that used to belong to a 刷新 button,
 * which is why there is no longer one. Polling stops while the tab is hidden
 * and backs off when rounds fail.
 *
 * **Dismissal is deliberate.** A pointerdown anywhere outside closes the
 * window — same contract as the shell's own popovers — unless the pin is set,
 * which suspends only that rule: pinning never takes away dragging or resizing.
 * Escape is not bound: the shell does not bind it for its popovers either, and
 * this window is not modal, so claiming Escape would steal it from the composer
 * and from any open menu.
 *
 * Toggling writes the same per-conversation JSON the settings page and the
 * `skill_select` tool write, so all three always agree.
 * @module
 */

import { SMC_API } from '../../shared/protocol/index.ts'
import { errorText, format } from '../shared/format.ts'
import type { SkillsMcpKey } from '../shared/locales.ts'
import { fingerprintOf, sortedRows, type PanelSkillRow, type PanelView } from './panel-state.ts'

const PANEL_ID = 'smc-fp'
const STYLE_ID = 'dsh-s-m-c-sidebar-style'
const PANEL_Z = 9999
/** localStorage key the dsh session controller persists its selection under. */
const SESSION_STORAGE_KEY = 'dsh.sessions.current'
/** Separator dsh's DocumentTitle layer puts between session and product title. */
const TITLE_SEPARATOR = ' — '
/** Remembered window geometry (localStorage: a real preference, kept for good). */
const PANEL_BOX_KEY = 'dsh-s-m-c-center.panel.box'
/** Whether the window is open (sessionStorage: survives our reload, not a new tab). */
const PANEL_OPEN_KEY = 'dsh-s-m-c-center.panel.open'
/** Smallest size the window may be dragged down to. */
const MIN_W = 260
const MIN_H = 150
/** One poll period while the window is open and its tab is visible. */
const POLL_MS = 1000
/** Ceiling for the poll's failure backoff. */
const MAX_BACKOFF_MS = 30_000

/** The translator this module needs: one key in, one string out. */
export type PanelTranslate = (key: SkillsMcpKey) => string

/** Teardown for the one live window, if there is one. */
let activeDispose: (() => void) | undefined
/**
 * The entry button that opened the window.
 *
 * Kept in module scope rather than per-window because the entry can be
 * remounted by the shell while the window stays up.
 */
let activeAnchor: HTMLElement | undefined
/** Subscribers to "the window opened or closed" (the sidebar entry reads it). */
const listeners = new Set<() => void>()

/** Subscribe to the window's open state. @returns the unsubscribe function. */
export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Announce an open/close so the entry can redraw its own affordance. */
function notifyPanel(): void {
  for (const listener of listeners) listener()
}

/**
 * Whether a window is showing.
 *
 * Read from the DOM rather than mirrored in a variable: the window can be torn
 * down from places React never sees (the plugin unloading), and a stale flag
 * would leave the entry claiming it is open.
 * @returns true when the panel element is in the document.
 */
export function isPanelOpen(): boolean {
  return document.getElementById(PANEL_ID) !== null
}

/** Close the window if one is open. Safe to call when none is. */
export function closePanel(): void {
  activeDispose?.()
}

/** One fetch round trip with the same error shape as the settings client. */
async function api<T>(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<T> {
  const response = await fetch(path, payload === undefined
    ? { method }
    : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  let body: unknown
  try { body = await response.json() } catch { throw new Error(`HTTP ${response.status}`) }
  if (!response.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error(String((body as { error?: unknown }).error ?? `HTTP ${response.status}`))
  }
  return body as T
}

/** Remembered geometry, or null when the window has never been moved. */
function readBox(): { left: number; top: number; width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(PANEL_BOX_KEY)
    if (raw === null) return null
    const box = JSON.parse(raw) as Record<string, unknown>
    const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)
    const left = num(box.left); const top = num(box.top)
    const width = num(box.width); const height = num(box.height)
    if (left === null || top === null || width === null || height === null) return null
    return { left, top, width, height }
  } catch { return null }
}

/** Persist the window's geometry (best effort — storage can be unavailable). */
function writeBox(box: { left: number; top: number; width: number; height: number }): void {
  try { localStorage.setItem(PANEL_BOX_KEY, JSON.stringify(box)) } catch { /* storage full/blocked */ }
}

/** Whether the window should come back on its own after our reload. */
export function readOpenFlag(): boolean {
  try { return sessionStorage.getItem(PANEL_OPEN_KEY) === '1' } catch { return false }
}

/** Record the window's open state for the next reload, or forget it. */
function writeOpenFlag(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(PANEL_OPEN_KEY, '1')
    else sessionStorage.removeItem(PANEL_OPEN_KEY)
  } catch { /* storage unavailable */ }
}

/** Pin artwork, path-for-path from the shell's IconPin{Outline,Fill}Regular. */
const PIN_HEAD = 'M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z'
const PIN_LEG = 'M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z'

/** The pin glyph: outlined when loose, filled when set — the shell's convention. */
function pinSvg(pinned: boolean): string {
  const head = pinned
    ? `<path d="${PIN_HEAD}" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.4"/>`
    : `<path d="${PIN_HEAD}" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.4"/>`
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">${head}<path d="${PIN_LEG}" fill="currentColor"/></svg>`
}

/** Inject the one-time stylesheet (theme variables + light fallbacks). */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
/* Default size matches the shell's other status window (dsh-perf-monitor) so the
   two read as siblings; drag and corner-resize still override it, and the
   clamps keep a resized window from growing past the viewport. */
.smc-fp{position:fixed;left:280px;top:80px;width:330px;height:500px;
  max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);
  min-width:${MIN_W}px;min-height:${MIN_H}px;z-index:${PANEL_Z};
  display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1f2328);
  border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:12px;box-shadow:0 12px 40px rgba(8,10,16,.18);
  font-size:13px;overflow:hidden;resize:both}
.smc-fp-head{display:flex;align-items:center;gap:6px;padding:8px 10px 8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1);
  cursor:grab;user-select:none;touch-action:none}
.smc-fp-head.smc-dragging{cursor:grabbing}
.smc-fp-head b{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Head buttons share one box so the pin and the close cannot squeeze each other. */
.smc-fp-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;
  border:none;border-radius:6px;background:transparent;color:inherit;cursor:pointer;opacity:.7;line-height:1}
.smc-fp-icon:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,#f0f1f3)}
.smc-fp-icon[aria-pressed="true"]{opacity:1}
.smc-fp-pin[aria-pressed="true"]{color:var(--dsw-alias-state-business-primary,#3b6fe0)}
.smc-fp-sub{padding:8px 12px 0;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px}
.smc-fp-sub .t{color:inherit;font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.smc-fp-body{overflow:auto;padding:8px 12px 12px;flex:1}
.smc-fp-row{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--dsw-alias-border-l2,#f1f2f4)}
.smc-fp-row .t{flex:1;min-width:0}
.smc-fp-row .t .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-row .t .d{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-note{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;padding:4px 2px}
.smc-fp-err{color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;padding:4px 2px}
`
  document.head.appendChild(style)
}

interface SkillRow {
  name: string
  description: string
  group: string
  slug?: string
  path: string
  kind: 'bundle' | 'file'
  level?: string
  linked?: boolean
}

/** The conversation the user is looking at, read from the dsh client's own state. */
function currentConversation(): { id: string | undefined; title: string } {
  let id: string | undefined
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as { sessionId?: unknown }
      if (typeof parsed?.sessionId === 'string' && parsed.sessionId !== '') id = parsed.sessionId
    }
  } catch { /* corrupt or unavailable storage → no session */ }
  // document.title is `${session title} — ${product}` while a titled session
  // is open; the bare product title means a blank/new conversation.
  const full = document.title
  const at = full.lastIndexOf(TITLE_SEPARATOR)
  const title = at > 0 ? full.slice(0, at) : ''
  return { id, title }
}

/**
 * One toggle round trip against the live routes.
 *
 * No cwd: every selection lives in one relay table on the host, keyed by
 * session id, so this window and the settings page read the same document.
 */
async function toggleSkill(sessionId: string, slug: string): Promise<{ selected: string[] }> {
  const body = await api<{ selection: { selected: string[] }; applied: boolean }>(
    'POST', SMC_API.contextsToggle, { sessionId, slug },
  )
  return body.selection
}

/** Drop this conversation's own selection so it follows the default again. */
async function resetSelection(sessionId: string): Promise<string[]> {
  const body = await api<{ selection: { selected: string[] } }>(
    'POST', SMC_API.contextsReset, { sessionId },
  )
  return body.selection.selected
}

/**
 * Own the window's client-side lifetime: its stylesheet, and the window.
 *
 * One disposer for both because they are one feature — the stylesheet has no
 * business outliving the plugin, and the window has to come down when it does.
 * @returns the teardown to hand to `ctx.effect`.
 */
export function mountConversationPanel(): () => void {
  ensureStyle()
  return () => {
    closePanel()
    document.getElementById(STYLE_ID)?.remove()
  }
}

/**
 * Open the conversation-skills window, anchored to the sidebar entry.
 * @param anchor - the entry button, used for first placement and excluded from
 *                 outside-pointer dismissal.
 * @param t - the translator, so every string in the window follows the locale.
 */
export function openPanel(anchor: HTMLElement, t: PanelTranslate): void {
  if (document.getElementById(PANEL_ID) !== null) {
    // Already up. This happens when the shell remounts the entry while the
    // window is showing; re-bind the anchor and leave everything else alone,
    // because reopening would throw away the geometry the user dragged into.
    activeAnchor = anchor
    notifyPanel()
    return
  }
  ensureStyle()
  activeAnchor = anchor

  // Which conversation the window is about. Refilled on every poll round by
  // `fetchView`, because a switch or a rename changes the page under us.
  let sessionId: string | undefined
  const saved = readBox()

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.className = 'smc-fp'
  if (saved !== null) {
    panel.style.width = `${saved.width}px`
    panel.style.height = `${saved.height}px`
  }

  // ── header ────────────────────────────────────────────────────────────────
  const head = document.createElement('div')
  head.className = 'smc-fp-head'
  const title = document.createElement('b')
  title.textContent = t('panelTitle')

  /** Pin state: suspends dismissal only — dragging and resizing stay untouched. */
  let pinned = false
  const pin = document.createElement('button')
  pin.type = 'button'
  pin.className = 'smc-fp-icon smc-fp-pin'
  const syncPin = (): void => {
    pin.innerHTML = pinSvg(pinned)
    // aria-pressed is what the stylesheet keys the "set" look off, and what a
    // screen reader announces — one attribute, both jobs.
    pin.setAttribute('aria-pressed', pinned ? 'true' : 'false')
    const label = pinned ? t('panelUnpin') : t('panelPin')
    pin.setAttribute('aria-label', label)
    pin.title = label
  }
  syncPin()
  pin.addEventListener('click', () => { pinned = !pinned; syncPin() })

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'smc-fp-icon'
  close.textContent = '\u2715'
  close.setAttribute('aria-label', t('panelClose'))
  close.title = t('panelClose')
  head.append(title, pin, close)

  const sub = document.createElement('div')
  sub.className = 'smc-fp-sub'
  const subTitle = document.createElement('div')
  subTitle.className = 't'
  sub.append(subTitle)

  const bodyEl = document.createElement('div')
  bodyEl.className = 'smc-fp-body'
  panel.append(head, sub, bodyEl)
  document.body.appendChild(panel)
  writeOpenFlag(true)
  notifyPanel()

  // ── geometry bookkeeping ──────────────────────────────────────────────────
  /** Where the window currently sits, in viewport coordinates. */
  const boxOf = (): { left: number; top: number; width: number; height: number } => {
    const r = panel.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }

  // The window is the user's to place: remember only what they moved or
  // resized. Relayout (a collapsing sidebar, a re-dock) must not be mistaken
  // for a user action, or the window would freeze wherever it happened to be.
  let persistTimer: number | undefined
  let settled: { width: number; height: number } | null = null
  const persist = (): void => { writeBox(boxOf()) }
  const schedulePersist = (): void => {
    if (persistTimer !== undefined) return
    persistTimer = window.setTimeout(() => { persistTimer = undefined; persist() }, 150)
  }
  const resizeObserver = new ResizeObserver(() => {
    const r = panel.getBoundingClientRect()
    if (settled === null) { settled = { width: r.width, height: r.height }; return }
    if (Math.abs(r.width - settled.width) < 1 && Math.abs(r.height - settled.height) < 1) return
    settled = { width: r.width, height: r.height }
    schedulePersist()
  })

  /** The listeners a drag installed, so closing mid-drag cannot strand them. */
  let dragCleanup: (() => void) | undefined

  // ── lifecycle ─────────────────────────────────────────────────────────────
  let closed = false
  let timer: number | undefined
  let rafId: number | undefined

  /**
   * Tear the window down completely.
   *
   * Everything it installed has to come off here, or a closed window keeps
   * polling, keeps listening on `document`, and keeps a drag alive across a
   * sidebar re-render:
   *   - the self-rescheduling poll timer
   *   - the pending geometry-persist timeout (which would otherwise measure a
   *     detached rect and write a bogus box to storage)
   *   - the boot placement frame
   *   - the outside-pointerdown and visibilitychange listeners
   *   - the ResizeObserver
   *   - a drag's window mousemove/mouseup, when the window closes mid-drag and
   *     the mouseup that would have removed them never arrives
   */
  const dispose = (): void => {
    if (closed) return
    closed = true
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    if (persistTimer !== undefined) { clearTimeout(persistTimer); persistTimer = undefined }
    if (rafId !== undefined) { cancelAnimationFrame(rafId); rafId = undefined }
    dragCleanup?.()
    dragCleanup = undefined
    resizeObserver.disconnect()
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('visibilitychange', onVisibility)
    writeOpenFlag(false)
    panel.remove()
    if (activeDispose === dispose) { activeDispose = undefined; activeAnchor = undefined }
    notifyPanel()
  }
  activeDispose = dispose
  close.addEventListener('click', () => { dispose() })

  // Outside-pointer dismissal, the same contract as the shell's
  // useDismissOnOutsidePointer: a `pointerdown` in the bubble phase, no key
  // filter, and no `scroll` handling (scrolling raises no pointerdown). Two
  // exclusions, both load-bearing:
  //   - the window itself, or clicking a checkbox would close it;
  //   - the entry button, or pressing it would close here first and then reopen
  //     on click — a flicker that also throws away the geometry.
  // The shell gets the second exclusion for free because its trigger lives
  // inside the root it tests; ours lives in a different React tree.
  const onPointerDown = (event: Event): void => {
    if (pinned) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (panel.contains(target)) return
    if (activeAnchor?.contains(target) === true) return
    dispose()
  }
  document.addEventListener('pointerdown', onPointerDown)

  // ── drag / place ──────────────────────────────────────────────────────────
  // Drag by the header, but never so far that the window becomes unreachable:
  // the header must keep at least a sliver inside the viewport.
  head.addEventListener('mousedown', (event) => {
    if ((event.target as HTMLElement).closest('button') !== null) return
    event.preventDefault()
    const start = boxOf()
    const fromX = event.clientX
    const fromY = event.clientY
    head.classList.add('smc-dragging')
    const move = (e: MouseEvent): void => {
      const left = Math.min(Math.max(start.left + e.clientX - fromX, -start.width + 120), window.innerWidth - 40)
      const top = Math.min(Math.max(start.top + e.clientY - fromY, 0), window.innerHeight - 24)
      panel.style.left = `${Math.round(left)}px`
      panel.style.top = `${Math.round(top)}px`
    }
    const up = (): void => {
      dragCleanup?.()
      dragCleanup = undefined
      // The user's word is final from here on.
      persist()
    }
    dragCleanup = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      head.classList.remove('smc-dragging')
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  })

  // Sit where the user left it; first time round, dock beside the entry
  // (viewport-clamped) so the window never covers the conversation it describes.
  const entryRect = anchor.getBoundingClientRect()
  panel.style.visibility = 'hidden'
  rafId = requestAnimationFrame(() => {
    rafId = undefined
    const panelRect = panel.getBoundingClientRect()
    let left: number
    let top: number
    if (saved !== null) {
      left = Math.min(Math.max(saved.left, -panelRect.width + 120), Math.max(0, window.innerWidth - 40))
      top = Math.min(Math.max(saved.top, 0), Math.max(0, window.innerHeight - 24))
    } else {
      left = entryRect.right + 12
      if (left + panelRect.width > window.innerWidth - 8) {
        left = Math.max(8, entryRect.left - panelRect.width - 12)
      }
      top = Math.min(Math.max(entryRect.top - 4, 8), Math.max(8, window.innerHeight - panelRect.height - 8))
    }
    panel.style.left = `${Math.round(left)}px`
    panel.style.top = `${Math.round(top)}px`
    panel.style.visibility = ''
    resizeObserver.observe(panel)
  })

  // ── drawing ───────────────────────────────────────────────────────────────
  const note = (text: string, isError = false): void => {
    const el = document.createElement('div')
    el.className = isError ? 'smc-fp-err' : 'smc-fp-note'
    el.textContent = text
    bodyEl.appendChild(el)
  }

  const render = (view: PanelView): void => {
    bodyEl.textContent = ''
    if (view.error !== null) {
      note(view.error, true)
      return
    }
    const id = sessionId
    if (id === undefined) {
      note(t('panelNoSession'))
      return
    }
    // Which state this window is showing is not cosmetic: the settings page
    // reads the same relay table, so "跟随默认" here means the default card up
    // there is what governs this conversation.
    note(view.configured ? t('panelConfigured') : t('panelInherited'))
    note(format(t('panelTable'), { path: view.table === '' ? t('panelTableUnresolved') : view.table }))
    // Only offered once the conversation has a selection of its own: without
    // one there is nothing to drop, and the button would do nothing.
    if (view.configured) {
      const reset = document.createElement('button')
      reset.type = 'button'
      reset.textContent = t('panelReset')
      reset.title = t('panelResetTitle')
      reset.style.cssText = 'border:1px solid currentColor;background:transparent;color:inherit;'
        + 'cursor:pointer;font-size:12px;padding:2px 8px;border-radius:6px;opacity:.8;margin:2px 0 4px'
      reset.addEventListener('click', () => {
        const target = sessionId
        if (target === undefined) return
        reset.disabled = true
        pendingWrites += 1
        resetSelection(target).catch((e: unknown) => {
          note(errorText(e), true)
          reset.disabled = false
        }).finally(() => {
          pendingWrites -= 1
          // Force the next round to re-read and reconcile with what the Host
          // actually stored, rather than trusting the optimistic redraw.
          lastPrint = null
          kick()
        })
      })
      bodyEl.appendChild(reset)
    }
    if (view.rows.length === 0) {
      note(t('panelEmpty'))
      return
    }
    const picked = new Set(view.selected)
    for (const row of view.rows) {
      const line = document.createElement('div')
      line.className = 'smc-fp-row'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = picked.has(row.slug)
      const text = document.createElement('div')
      text.className = 't'
      const nameEl = document.createElement('div')
      nameEl.className = 'n'
      nameEl.textContent = row.name
      const descEl = document.createElement('div')
      descEl.className = 'd'
      descEl.textContent = row.description
      text.append(nameEl, descEl)
      line.append(box, text)
      box.addEventListener('change', () => {
        const target = sessionId
        if (target === undefined) return
        box.disabled = true
        pendingWrites += 1
        toggleSkill(target, row.slug).then((selection) => {
          picked.clear()
          for (const slug of selection.selected) picked.add(slug)
          box.checked = picked.has(row.slug)
          box.disabled = false
        }).catch((e: unknown) => {
          note(errorText(e), true)
          box.checked = picked.has(row.slug)
          box.disabled = false
        }).finally(() => {
          pendingWrites -= 1
          lastPrint = null
          kick()
        })
      })
      bodyEl.appendChild(line)
    }
  }

  // ── the silent refresh ────────────────────────────────────────────────────
  //
  // 1 Hz, but nothing is redrawn unless the content actually changed: the
  // window re-reads *the current conversation* every round (so switching
  // conversations or renaming one is followed within a second — that job used
  // to belong to a 刷新 button), re-fetches the list and the selection, and
  // compares a fingerprint of the whole result.
  //
  // A self-rescheduling timeout, not setInterval: the delay has to change
  // (failure backoff), and one pending handle is the whole cleanup surface.
  /** Fingerprint of the last *drawn* view; null forces the next round to draw. */
  let lastPrint: string | null = null
  /** Writes in flight; while any is, a round would stamp over the user's click. */
  let pendingWrites = 0
  let inFlight = false
  let failures = 0
  let delay = POLL_MS

  const schedule = (): void => {
    if (closed) return
    timer = window.setTimeout(() => { void tick() }, delay)
  }

  /**
   * Poll right now instead of waiting out the period.
   *
   * Immediate on purpose: the two callers both mean "something just happened,
   * reconcile" — a write that settled, or a tab that came back — and making them
   * wait a second would show the user a stale window for no reason. A round
   * already in flight makes this a no-op, so the two cannot stack.
   */
  const kick = (): void => {
    if (closed) return
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    delay = POLL_MS
    void tick()
  }

  /**
   * Read the page and the Host, and fold both into one normalised view.
   *
   * A failed round comes back as a view carrying the message, so the caller
   * does not have to special-case it.
   */
  const fetchView = async (): Promise<PanelView> => {
    const conversation = currentConversation()
    sessionId = conversation.id
    if (conversation.id === undefined) {
      return {
        sessionId: undefined, title: conversation.title, rows: [],
        selected: [], configured: false, table: '', error: null,
      }
    }
    try {
      const [skillBody, selectionBody] = await Promise.all([
        api<{ items: SkillRow[] }>('GET', SMC_API.skills),
        api<{ table: string; selection: { selected: string[]; configured?: boolean } }>(
          'POST', SMC_API.contextsGet, { sessionId: conversation.id },
        ),
      ])
      // Same rule as the settings card: **linked** skills only — this window
      // manages injection for what actually sits in the skill roots.
      const rows: PanelSkillRow[] = sortedRows(skillBody.items
        .filter((s) => s.level === 'user' && s.linked === true && typeof s.slug === 'string' && s.slug !== '')
        .map((s) => ({ name: s.name, slug: s.slug ?? '', description: s.description })))
      return {
        sessionId: conversation.id,
        title: conversation.title,
        rows,
        selected: selectionBody.selection.selected,
        configured: selectionBody.selection.configured === true,
        table: selectionBody.table,
        error: null,
      }
    } catch (e) {
      return {
        sessionId: conversation.id, title: conversation.title, rows: [],
        selected: [], configured: false, table: '', error: errorText(e),
      }
    }
  }

  /** Redraw only when the fingerprint moved; the caption is cheap and idempotent. */
  const applyView = (view: PanelView): void => {
    const caption = view.sessionId === undefined
      ? t('panelNewConversation')
      : (view.title !== '' ? view.title : t('panelCurrentConversation'))
    if (subTitle.textContent !== caption) subTitle.textContent = caption
    const print = fingerprintOf(view)
    if (print === lastPrint) return
    lastPrint = print
    render(view)
  }

  /**
   * One round: read the page, fetch, compare, maybe redraw, reschedule.
   *
   * The three early-outs are deliberate:
   *  - a write in flight: drawing now would stamp the Host's older selection
   *    over the box the user just clicked. Skipping a second is invisible, and
   *    the settled request clears the fingerprint so the next round reconciles.
   *  - a hidden tab: no traffic while nobody is looking; `visibilitychange`
   *    polls once immediately on return so the window is never stale.
   *  - an overlapping round: the visibility kick cannot stack on top of a round
   *    that is still awaiting its response.
   */
  const tick = async (): Promise<void> => {
    if (closed) return
    if (pendingWrites > 0 || document.hidden || inFlight) { delay = POLL_MS; schedule(); return }
    inFlight = true
    const view = await fetchView()
    inFlight = false
    if (closed) return
    if (view.error !== null) {
      failures += 1
      delay = Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS)
    } else {
      failures = 0
      delay = POLL_MS
    }
    applyView(view)
    schedule()
  }

  /** A tab coming back polls at once instead of waiting out the period. */
  const onVisibility = (): void => {
    if (closed || document.hidden) return
    kick()
  }
  document.addEventListener('visibilitychange', onVisibility)

  bodyEl.textContent = t('loading')
  void tick()
}
