/**
 * The conversation-skills window: a floating panel, and only that.
 *
 * The sidebar *entry* that opens it lives here too, and sits directly under the
 * New Session button. The shell declares no slot above the workspaces region,
 * so the row is anchored to that button and re-anchored after a re-render.
 * The window itself is deliberately imperative DOM on `document.body`:
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
import type { SkillsMcpKey } from '../shared/locales.ts';
/** The translator this module needs: one key in, one string out. */
export type PanelTranslate = (key: SkillsMcpKey) => string;
/** Subscribe to the window's open state. @returns the unsubscribe function. */
export declare function subscribePanel(listener: () => void): () => void;
/**
 * Whether a window is showing.
 *
 * Read from the DOM rather than mirrored in a variable: the window can be torn
 * down from places React never sees (the plugin unloading), and a stale flag
 * would leave the entry claiming it is open.
 * @returns true when the panel element is in the document.
 */
export declare function isPanelOpen(): boolean;
/** Close the window if one is open. Safe to call when none is. */
export declare function closePanel(): void;
/** Whether the window should come back on its own after our reload. */
export declare function readOpenFlag(): boolean;
/**
 * Own the window's client-side lifetime: its stylesheet, and the window.
 *
 * One disposer for both because they are one feature — the stylesheet has no
 * business outliving the plugin, and the window has to come down when it does.
 * @returns the teardown to hand to `ctx.effect`.
 */
export declare function mountConversationPanel(): () => void;
/**
 * Open the conversation-skills window, anchored to the sidebar entry.
 * @param anchor - the entry button, used for first placement and excluded from
 *                 outside-pointer dismissal.
 * @param t - the translator, so every string in the window follows the locale.
 */
export declare function openPanel(anchor: HTMLElement, t: PanelTranslate): void;
/**
 * Place the entry directly under the New Session button.
 *
 * The button is found by the CSS-module class that keeps the original word
 * (`newSession` survives hashing), with the localised aria-label as the backup;
 * the brand button carries the same label, so the class is tried first. The
 * column is matched by the `sidebarCol` fragment or the declared slot mark —
 * the old `data-pane="sidebar"` no longer exists in the shell.
 * @param entry - the row to place.
 * @returns whether the entry now sits directly after New Session.
 */
export declare function placeEntry(entry: HTMLElement): boolean;
/**
 * Mount the entry under New Session, and keep it there.
 *
 * The sidebar is the shell's tree and it re-renders: a node inserted into it
 * can be evicted. Placement is therefore re-asserted on mutations, but only
 * placement — the window, its geometry and any drag in progress are untouched,
 * so a re-render never costs the user their position.
 *
 * Two observers, because they watch different things: one on the column for
 * re-renders that keep us mounted, one on the document for the case where the
 * shell replaced the whole column and dropped us. Watching only the document
 * would fire on every streamed token in the message column.
 * @param ctx - client root context; owns the effect's lifetime.
 * @param t - translator, captured for the click handler.
 */
export declare function mountSidebarEntry(ctx: {
    effect: (run: () => () => void, label?: string) => () => void;
}, t: PanelTranslate): void;
//# sourceMappingURL=sidebar.d.ts.map