/**
 * Sidebar entry + floating panel for the conversation-skill selection.
 *
 * The settings card cannot host this block well (it has no notion of "the
 * conversation you are looking at"), so the entry lives in the web shell's
 * sidebar right under the New Session button, and the panel is a small
 * fixed-position window. Rendering is imperative DOM on purpose: the panel
 * outlives the settings card's React tree and must survive shell re-renders
 * with the same self-healing pattern the family uses.
 *
 * The panel is a *window*, not a docked popover: it is dragged by its header
 * and resized from its corner, and both stick (localStorage). A position is
 * only chosen for it the first time — after that the user's word is final.
 *
 * The panel always shows *the conversation you are in*: the session id comes
 * from the dsh client's persisted selection (`localStorage['dsh.sessions.current']`,
 * written by the session controller on every switch) and the title from
 * `document.title` (the layout layer projects the current session title there,
 * suffixed with ` — <product>`). 刷新 re-reads both and re-fetches the list, so
 * a renamed conversation shows its new name without leaving the page — a full
 * reload was the earlier answer to that, and it cost the window's position and
 * anything typed in the composer. The open state lives in sessionStorage so the
 * panel comes back after a reload the user asked for themselves — but not in a
 * new tab, where nothing did.
 *
 * Toggling writes the same per-conversation JSON the settings page and the
 * `skill_select` tool write, so all three always agree.
 * @module
 */

import { SMC_API } from '../../shared/protocol/index.ts'

const ENTRY_ID = 'data-dsh-s-m-c-entry'
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
function readOpenFlag(): boolean {
  try { return sessionStorage.getItem(PANEL_OPEN_KEY) === '1' } catch { return false }
}

/** Record the window's open state for the next reload, or forget it. */
function writeOpenFlag(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(PANEL_OPEN_KEY, '1')
    else sessionStorage.removeItem(PANEL_OPEN_KEY)
  } catch { /* storage unavailable */ }
}

/** Inject the one-time stylesheet (theme variables + light fallbacks). */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[data-dsh-frame][data-sidebar-collapsed] [${ENTRY_ID}]{justify-content:center!important;width:100%!important;padding:0!important}
[data-dsh-frame][data-sidebar-collapsed] [${ENTRY_ID}]>span:not(:first-child){display:none!important}
.smc-fp{position:fixed;left:280px;top:80px;width:min(420px,92vw);height:min(560px,72vh);min-width:${MIN_W}px;min-height:${MIN_H}px;z-index:${PANEL_Z};
  display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1f2328);
  border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:12px;box-shadow:0 12px 40px rgba(8,10,16,.18);
  font-size:13px;overflow:hidden;resize:both}
.smc-fp-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1);
  cursor:grab;user-select:none;touch-action:none}
.smc-fp-head.smc-dragging{cursor:grabbing}
.smc-fp-head b{flex:1;font-size:13px}
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

/** Build the sidebar entry button (icon + label), family-placed. */
function buildEntry(onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute(ENTRY_ID, '')
  button.setAttribute('aria-label', '会话技能')
  button.style.cssText = [
    'display:flex', 'align-items:center', 'gap:8px', 'width:100%', 'padding:8px 10px',
    'border:none', 'background:transparent', 'color:inherit', 'cursor:pointer', 'text-align:left',
    'font:inherit', 'border-radius:8px',
  ].join(';')
  const icon = document.createElement('span')
  icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9H3z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M6 8h4M6 11h4" stroke="currentColor" stroke-width="1.4"/></svg>'
  const label = document.createElement('span')
  label.textContent = '会话技能'
  button.append(icon, label)
  button.addEventListener('click', onClick)
  return button
}

/**
 * Place the entry as the first item under the New Session button.
 *
 * The button is found by its CSS-module class (hashed names keep the original
 * word) with the localized aria-label as the backup — the brand button shares
 * the aria-label, so class matching wins. Falls back to the plugin-family
 * block while the shell renders a layout without the button.
 */
function placeEntry(entry: HTMLElement): boolean {
  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return false
  const buttons = Array.from(column.querySelectorAll('button'))
  const newSession = buttons.find((b) => /newSession/i.test(b.className))
    ?? buttons.find((b) => {
      const label = b.getAttribute('aria-label') ?? ''
      return (label === '新建会话' || label === 'New session') && !/brand/i.test(b.className)
    })
  if (newSession !== undefined) {
    if (entry.parentElement === newSession.parentElement && entry.previousElementSibling === newSession) return true
    newSession.after(entry)
    return true
  }
  // Fallback: after the plugin-family block (the pre-新会话 layout).
  const logoRow = column.querySelector('[class*="logoRow"]')
  const root = (logoRow?.parentElement ?? column.firstElementChild) as HTMLElement | null
  if (root === null) return false
  if (entry.parentElement === root && root.contains(entry)) return true
  const family = root.querySelectorAll('[data-dsh-taskboard-entry],[data-dsh-ssh-entry],[data-dsh-skill-explorer-entry]')
  const last = family.length > 0 ? family[family.length - 1] : (logoRow ?? root.firstElementChild)
  if (last?.parentElement === root) last.after(entry)
  else root.insertBefore(entry, root.firstChild)
  return true
}

interface SkillRow { name: string; description: string; group: string; slug?: string; path: string; kind: 'bundle' | 'file'; level?: string; linked?: boolean }

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
 * session id, so this panel and the settings page read the same document.
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
 * Open the floating panel.
 *
 * Which conversation this panel is about (its id and title) is read from the
 * page at open time — the session id from the client's persisted selection and
 * the title from `document.title`. 刷新 re-reads both and re-fetches the list,
 * so renaming a conversation shows up without a page reload. (An earlier
 * version reloaded the whole page instead, which did fix the stale title but
 * threw away the window's position and everything typed in the composer.)
 */
function openPanel(entry: HTMLElement): void {
  ensureStyle()
  document.getElementById(PANEL_ID)?.remove()

  // Which conversation the panel is about. Filled in by `syncConversation()`
  // below and re-read on 刷新: a switch or a rename changes the page under us.
  let sessionId: string | undefined
  const cwd = ''
  const saved = readBox()

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.className = 'smc-fp'
  if (saved !== null) {
    panel.style.width = `${saved.width}px`
    panel.style.height = `${saved.height}px`
  }
  const head = document.createElement('div')
  head.className = 'smc-fp-head'
  const title = document.createElement('b')
  title.textContent = '会话技能'
  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.textContent = '↻ 刷新'
  refresh.title = '重新读取当前会话与技能列表（不刷新整个页面）'
  refresh.style.cssText = 'border:none;background:transparent;color:inherit;cursor:pointer;font-size:12px;opacity:.75'
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '✕'
  close.style.cssText = 'border:none;background:transparent;color:inherit;cursor:pointer;font-size:14px'
  /** Set once the geometry watcher exists; closing must not leave it running. */
  let stopWatching = (): void => {}
  close.addEventListener('click', () => { writeOpenFlag(false); stopWatching(); panel.remove() })
  head.append(title, refresh, close)

  const sub = document.createElement('div')
  sub.className = 'smc-fp-sub'
  const subTitle = document.createElement('div')
  subTitle.className = 't'
  const subId = document.createElement('div')
  sub.append(subTitle, subId)

  /**
   * Re-read which conversation we are in and redraw the caption. Everything
   * that re-fetches (刷新, and a re-open) calls this first, because the id and
   * the title both live on the page and can change under us — a rename only
   * touches `document.title`.
   */
  const syncConversation = (): void => {
    const current = currentConversation()
    sessionId = current.id
    subTitle.textContent = sessionId === undefined ? '新会话（尚未开始对话）' : (current.title || '当前会话')
    subId.textContent = sessionId === undefined ? '开始对话后即可在此选择技能' : sessionId.slice(0, 8) + '…'
  }
  syncConversation()

  const bodyEl = document.createElement('div')
  bodyEl.className = 'smc-fp-body'
  bodyEl.textContent = '加载中…'
  panel.append(head, sub, bodyEl)
  document.body.appendChild(panel)
  writeOpenFlag(true)

  /** Where the window currently sits, in viewport coordinates. */
  const boxOf = (): { left: number; top: number; width: number; height: number } => {
    const r = panel.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }

  // The window is the user's to place: remember only what they moved or
  // resized. Relayout (a collapsing sidebar, a re-dock) must not be mistaken
  // for a user action, or the window would freeze wherever it happened to be.
  let pending = 0
  let settled: { width: number; height: number } | null = null
  const persist = (): void => { writeBox(boxOf()) }
  const schedulePersist = (): void => {
    if (pending !== 0) return
    pending = window.setTimeout(() => { pending = 0; persist() }, 150)
  }
  const resizeObserver = new ResizeObserver(() => {
    const r = panel.getBoundingClientRect()
    if (settled === null) { settled = { width: r.width, height: r.height }; return }
    if (Math.abs(r.width - settled.width) < 1 && Math.abs(r.height - settled.height) < 1) return
    settled = { width: r.width, height: r.height }
    schedulePersist()
  })

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
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      head.classList.remove('smc-dragging')
      // The user's word is final from here on.
      persist()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  })

  // Sit where the user left it; first time round, dock beside the entry
  // (viewport-clamped) so the window never covers the conversation it describes.
  const entryRect = entry.getBoundingClientRect()
  panel.style.visibility = 'hidden'
  requestAnimationFrame(() => {
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
    stopWatching = () => { resizeObserver.disconnect() }
  })

  const note = (text: string, isError = false): void => {
    const el = document.createElement('div')
    el.className = isError ? 'smc-fp-err' : 'smc-fp-note'
    el.textContent = text
    bodyEl.appendChild(el)
  }

const render = (
  skillRows: SkillRow[],
  selection: { selected: string[]; configured?: boolean },
  table: string,
): void => {
  bodyEl.textContent = ''
  const id = sessionId
  if (id === undefined) {
    note('新会话还没有会话 ID——发第一条消息后，这里就会跟随该对话的技能选择')
    return
  }
  // Which state this panel is showing is not cosmetic: the settings page reads
  // the same relay table, so "跟随默认" here means the default card up there is
  // what governs this conversation.
  note(selection.configured === true ? '本会话已单独配置' : '本会话跟随「会话默认」')
  note('配置表：' + (table === '' ? '（未解析）' : table))
  // Only offered once the conversation has a selection of its own: without one
  // there is nothing to drop, and the button would do nothing.
  if (selection.configured === true) {
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.textContent = '跟随默认（清除本会话）'
    reset.title = '删除本会话自己的选择，改为跟随「会话默认」'
    reset.style.cssText = 'border:1px solid currentColor;background:transparent;color:inherit;'
      + 'cursor:pointer;font-size:12px;padding:2px 8px;border-radius:6px;opacity:.8'
    reset.addEventListener('click', () => {
      reset.disabled = true
      resetSelection(id).then(() => { load() }).catch((e: unknown) => {
        note(String((e as Error)?.message ?? e), true)
        reset.disabled = false
      })
    })
    bodyEl.appendChild(reset)
  }
  const picked = new Set(selection.selected)
  if (skillRows.length === 0) {
    note('没有可勾选的技能（先在管理页登记或迁移入库）')
    return
  }
    for (const row of skillRows) {
      const line = document.createElement('div')
      line.className = 'smc-fp-row'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = picked.has(row.slug ?? '')
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
        box.disabled = true
        toggleSkill(id, row.slug ?? '').then((selection) => {
          picked.clear()
          for (const slug of selection.selected) picked.add(slug)
          box.checked = picked.has(row.slug ?? '')
          box.disabled = false
        }).catch((e: unknown) => {
          note(String((e as Error)?.message ?? e), true)
          box.checked = picked.has(row.slug ?? '')
          box.disabled = false
        })
      })
      bodyEl.appendChild(line)
    }
  }

  const load = (): void => {
    bodyEl.textContent = ''
    bodyEl.textContent = '加载中…'
    void (async () => {
      try {
      const [skillBody, selectionBody] = await Promise.all([
        api<{ items: SkillRow[] }>('GET', cwd !== '' ? `${SMC_API.skills}?cwd=${encodeURIComponent(cwd)}` : SMC_API.skills),
        sessionId === undefined
          ? Promise.resolve({ selection: { selected: [] as string[] }, table: '' })
          : api<{ table: string; selection: { selected: string[]; configured?: boolean } }>(
            'POST', SMC_API.contextsGet, { sessionId },
          ),
      ])
      // Same rule as the settings card: **linked** skills only — this panel
      // manages injection for what actually sits in the skill roots.
      const rows = skillBody.items.filter((s) => s.level === 'user' && s.linked && typeof s.slug === 'string' && s.slug !== '')
      render(rows, selectionBody.selection, selectionBody.table)
      } catch (e) {
        bodyEl.textContent = ''
        note(String((e as Error)?.message ?? e), true)
      }
    })()
  }
  // 刷新 refreshes the panel, not the page: re-read the conversation (a rename
  // lands in document.title) and re-fetch. The window stays where it is.
  refresh.addEventListener('click', () => { syncConversation(); load() })
  load()
}

/** Mount the sidebar entry with the family's self-healing pattern. */
export function mountSidebarEntry(ctx: {
  effect: (run: () => () => void, label?: string) => () => void
}): void {
  const run = (): (() => void) => {
    ensureStyle()
    const entry = buildEntry(() => {
      openPanel(entry)
    })
    document.body.appendChild(entry)

    // A reload triggered from the panel brings it back: the open state lives in
    // sessionStorage, so the window reappears where the user left it.
    const openOnBoot = readOpenFlag()
    let bootOpened = false
    const openIfPending = (): void => {
      if (!openOnBoot || bootOpened) return
      bootOpened = true
      openPanel(entry)
    }

    const rootObserver = new MutationObserver(() => {
      if (document.body.contains(entry) && placeEntry(entry)) return
      placeEntry(entry)
    })
    const waitObserver = new MutationObserver(() => {
      if (!placeEntry(entry)) return
      rootObserver.observe(document.body, { childList: true, subtree: true })
      waitObserver.disconnect()
      openIfPending()
    })
    // The shell may already be up — our own reload lands on a rendered page —
    // in which case no mutation arrives for us to react to.
    if (placeEntry(entry) && document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]') !== null) {
      rootObserver.observe(document.body, { childList: true, subtree: true })
      openIfPending()
    } else {
      waitObserver.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      waitObserver.disconnect()
      rootObserver.disconnect()
      entry.remove()
      document.getElementById('smc-fp')?.remove()
    }
  }
  try {
    ctx.effect(run, 'dsh-s-m-c-center: sidebar')
  } catch (error) {
    console.warn('[dsh-s-m-c-center] sidebar mount failed:', error)
  }
}
