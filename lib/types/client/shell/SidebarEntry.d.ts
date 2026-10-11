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
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Props composed by the sidebar footer-action slot. */
export type SidebarEntryProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'dsh-s-m-c-center'>;
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
export declare function SidebarEntry({ wide, t }: SidebarEntryProps): import("react").JSX.Element;
//# sourceMappingURL=SidebarEntry.d.ts.map