/**
 * Sidebar entry + floating panel for the conversation-skill selection.
 *
 * The settings card cannot host this block well (it has no notion of "the
 * conversation you are looking at"), so the entry lives in the web shell's
 * sidebar like the other plugin-family buttons, and the panel is a small
 * fixed-position window. Rendering is imperative DOM on purpose: the panel
 * outlives the settings card's React tree and must survive shell re-renders
 * with the same self-healing pattern the family uses.
 *
 * Data comes straight from the plugin's own routes (contexts + skills); every
 * toggle posts to contexts/toggle, and a running conversation applies the
 * change live through its agent context.
 * @module
 */

import { SMC_API } from '../protocol.ts'

const ENTRY_ID = 'data-dsh-s-m-c-entry'
const STYLE_ID = 'dsh-s-m-c-sidebar-style'
const PANEL_Z = 9999

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

/** Inject the one-time stylesheet (theme variables + light fallbacks). */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[data-dsh-frame][data-sidebar-collapsed] [${ENTRY_ID}]{justify-content:center!important;width:100%!important;padding:0!important}
[data-dsh-frame][data-sidebar-collapsed] [${ENTRY_ID}]>span:not(:first-child){display:none!important}
.smc-fp{position:fixed;right:16px;bottom:16px;width:min(420px,92vw);max-height:min(560px,72vh);z-index:${PANEL_Z};
  display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1f2328);
  border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:12px;box-shadow:0 12px 40px rgba(8,10,16,.18);
  font-size:13px;overflow:hidden}
.smc-fp-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1)}
.smc-fp-head b{flex:1;font-size:13px}
.smc-fp-body{overflow:auto;padding:8px 12px 12px;flex:1}
.smc-fp-row{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--dsw-alias-border-l2,#f1f2f4)}
.smc-fp-row .t{flex:1;min-width:0}
.smc-fp-row .t .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-row .t .d{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.smc-fp-note{color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;padding:4px 2px}
.smc-fp-err{color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;padding:4px 2px}
.smc-fp select{max-width:180px;background:var(--dsw-alias-bg-layer-1,#f7f8fa);color:inherit;border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:6px;padding:3px 6px}
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

/** Place the entry after the plugin-family block inside the sidebar. */
function placeEntry(entry: HTMLElement): boolean {
  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return false
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

interface ContextRow { sessionId: string; count: number; updatedAt: string }
interface SkillRow { name: string; description: string; group: string; slug?: string; path: string; kind: 'bundle' | 'file'; level?: string }

/** One toggle round trip against the live routes. */
async function toggleSkill(sessionId: string, slug: string, cwd: string): Promise<{ selected: string[] }> {
  const body = await api<{ selection: { selected: string[] }; applied: boolean }>(
    'POST', SMC_API.contextsToggle, { sessionId, slug, cwd },
  )
  return body.selection
}

/**
 * Open (or refresh) the floating panel for one conversation. Data is fetched
 * fresh on every open; toggles update the row in place.
 */
function openPanel(sessionId: string, cwd: string): void {
  ensureStyle()
  const existing = document.getElementById('smc-fp')
  if (existing !== null) existing.remove()

  const panel = document.createElement('div')
  panel.id = 'smc-fp'
  panel.className = 'smc-fp'
  const head = document.createElement('div')
  head.className = 'smc-fp-head'
  const title = document.createElement('b')
  title.textContent = '会话技能 · ' + sessionId.slice(0, 8)
  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '✕'
  close.style.cssText = 'border:none;background:transparent;color:inherit;cursor:pointer;font-size:14px'
  close.addEventListener('click', () => { panel.remove() })
  head.append(title, close)
  const bodyEl = document.createElement('div')
  bodyEl.className = 'smc-fp-body'
  bodyEl.textContent = '加载中…'
  panel.append(head, bodyEl)
  document.body.appendChild(panel)

  const note = (text: string, isError = false): void => {
    const el = document.createElement('div')
    el.className = isError ? 'smc-fp-err' : 'smc-fp-note'
    el.textContent = text
    bodyEl.appendChild(el)
  }

  const render = (skillRows: SkillRow[], selected: string[], sessionList: ContextRow[]): void => {
    bodyEl.textContent = ''
    const picked = new Set(selected)
    const switcher = document.createElement('div')
    switcher.className = 'smc-fp-note'
    const label = document.createElement('span')
    label.textContent = '会话：'
    const select = document.createElement('select')
    for (const row of sessionList) {
      const option = document.createElement('option')
      option.value = row.sessionId
      option.textContent = row.sessionId.slice(0, 8) + `…（${row.count}）`
      if (row.sessionId === sessionId) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const next = select.value
      panel.remove()
      openPanel(next, cwd)
    })
    switcher.append(label, select)
    bodyEl.appendChild(switcher)

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
        toggleSkill(sessionId, row.slug ?? '', cwd).then((selection) => {
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
      line.append(box, text)
      bodyEl.appendChild(line)
    }
  }

  void (async () => {
    try {
      const [skillBody, contextBody] = await Promise.all([
        api<{ items: SkillRow[] }>('GET', cwd !== '' ? `${SMC_API.skills}?cwd=${encodeURIComponent(cwd)}` : SMC_API.skills),
        api<{ selections: ContextRow[] }>('POST', SMC_API.contextsGet, { sessionId, cwd })
          .then(() => api<{ selections: ContextRow[] }>('GET', cwd !== '' ? `${SMC_API.contexts}?cwd=${encodeURIComponent(cwd)}` : SMC_API.contexts)),
      ])
      const selectionBody = await api<{ selection: { selected: string[] } }>(
        'POST', SMC_API.contextsGet, { sessionId, cwd },
      )
      const rows = skillBody.items.filter((s) => s.level === 'user')
      render(rows, selectionBody.selection.selected, contextBody.selections)
    } catch (e) {
      bodyEl.textContent = ''
      note(String((e as Error)?.message ?? e), true)
    }
  })()
}

/** Mount the sidebar entry with the family's self-healing pattern. */
export function mountSidebarEntry(ctx: {
  effect: (run: () => () => void, label?: string) => () => void
}): void {
  const run = (): (() => void) => {
    ensureStyle()
    const entry = buildEntry(() => {
      // cwd: best effort — the plugin routes treat a missing cwd as the
      // process workspace, and the workspace picker can be added later.
      openPanel('default', '')
    })
    document.body.appendChild(entry)

    const rootObserver = new MutationObserver(() => {
      if (document.body.contains(entry) && placeEntry(entry)) return
      placeEntry(entry)
    })
    const waitObserver = new MutationObserver(() => {
      if (placeEntry(entry)) {
        rootObserver.observe(document.body, { childList: true, subtree: true })
        waitObserver.disconnect()
      }
    })
    waitObserver.observe(document.body, { childList: true, subtree: true })

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
