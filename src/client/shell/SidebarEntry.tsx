/**
 * The sidebar-foot entry that opens the conversation-skills window.
 *
 * A slot occupant, not DOM surgery. `sidebar.footer.action` renders inside the
 * sidebar's foot, directly above Settings, in both the wide column and the 56px
 * rail — the shell owns placement, re-rendering and the collapse crossfade, so
 * this component owns only the button, the label and the toggle.
 *
 * An earlier version injected the button by hand and re-anchored it from a
 * MutationObserver whenever the shell re-rendered. That whole apparatus goes
 * away here: a declarative seat cannot be evicted from the tree the shell owns,
 * and the collapsed rail arrives as the `wide` prop instead of a guessed
 * `[data-sidebar-collapsed]` selector.
 *
 * The window it opens stays imperative DOM on `document.body` (see sidebar.ts):
 * it must outlive this component, survive shell re-renders, and be dragged and
 * resized like a desktop window.
 *
 * The seat is shared, so the row also has a *place* in it to claim: whichever
 * other packages register a footer action, ours has to sit somewhere sensible
 * relative to theirs. That rule lives in footer-slot.ts; this component only
 * measures and applies it.
 * @module
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { placeFooterAction } from './footer-slot.ts'
import { closePanel, isPanelOpen, openPanel, readOpenFlag, subscribePanel } from './sidebar.ts'
import css from './sidebar-entry.module.css'

/** Props composed by the sidebar footer-action slot. */
export type SidebarEntryProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'dsh-s-m-c-center'>

/** The document-with-a-skill-mark glyph: the same one this entry always drew. */
function SkillGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 2h7l3 3v9H3z" stroke="currentColor" strokeWidth={1.4} fill="none" />
      <path d="M6 8h4M6 11h4" stroke="currentColor" strokeWidth={1.4} />
    </svg>
  )
}

/**
 * Render the foot entry.
 *
 * The window's open state is read from the DOM through `useSyncExternalStore`
 * rather than mirrored into React state, because the window closes from places
 * React never sees: a pointerdown outside it, the plugin unloading. Reading the
 * truth keeps this button's affordance honest no matter who closed it.
 * @param props - the sidebar column state plus this plugin's translator.
 * @returns the entry: icon + label wide, a 36x36 icon box in the rail.
 */
export function SidebarEntry({ wide, t }: SidebarEntryProps) {
  const ref = useRef<HTMLButtonElement>(null)
  /** Latest translator, so the boot-time reopen does not need it as a dep. */
  const translate = useRef(t)
  const booted = useRef(false)
  const open = useSyncExternalStore(subscribePanel, isPanelOpen, () => false)

  useEffect(() => { translate.current = t }, [t])

  // A reload the user asked for brings the window back where they left it. The
  // flag lives in sessionStorage, so this is a self-reload, never a new tab.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (!readOpenFlag()) return
    const button = ref.current
    if (button !== null) openPanel(button, translate.current)
  }, [])

  const label = t('panelTitle')

  // Claim our place in the shared seat.
  //
  // Measured rather than assumed: which packages share the foot is not
  // knowable from here, and a sibling can arrive after us or change size, so
  // the rule is re-applied whenever the seat's children change or the
  // container resizes.
  useEffect(() => {
    const button = ref.current
    if (button === null) return
    const slot = document.querySelector('[data-slot="sidebar.footer.action"]')
    if (slot === null) return

    // The shell lays out the element it sees in the seat, which is our row —
    // the direct child of the slot container, whatever wrapper depth React
    // happens to render at.
    let node: HTMLElement | null = button
    while (node !== null && node.parentElement !== slot) node = node.parentElement
    if (node === null) return
    const row = node

    const place = (): void => { placeFooterAction(row) }
    place()

    const arrivals = new MutationObserver(place)
    arrivals.observe(slot, { childList: true })

    // The slot wrapper is `display: contents` and therefore has no box to
    // observe, so the resize signal comes from the container that lays us out.
    const container = slot.parentElement
    const resize = container === null ? null : new ResizeObserver(place)
    if (container !== null && resize !== null) resize.observe(container)

    return () => {
      arrivals.disconnect()
      resize?.disconnect()
      row.style.removeProperty('order')
    }
  }, [])

  return (
    <div className={wide ? css.row : `${css.row} ${css.railRow}`}>
      <button
        ref={ref}
        type="button"
        className={wide ? css.entry : `${css.entry} ${css.rail}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        data-active={open ? '' : undefined}
        onClick={() => {
          const button = ref.current
          if (button === null) return
          // A toggle, not "open": the window's outside-pointerdown rule already
          // ignores a press on this button, so the click owns the close side on
          // its own and the two never fight.
          if (open) closePanel()
          else openPanel(button, translate.current)
        }}
      >
        <SkillGlyph size={wide ? 16 : 18} />
        {wide && <span className={css.label}>{label}</span>}
      </button>
    </div>
  )
}
