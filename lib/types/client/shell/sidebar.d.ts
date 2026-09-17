/**
 * Sidebar entry + floating panel for the conversation-skill selection.
 *
 * The settings card cannot host this block well (it has no notion of "the
 * conversation you are looking at"), so the entry lives in the web shell's
 * sidebar right under the New Session button, and the panel is a small
 * fixed-position window docked beside it. Rendering is imperative DOM on
 * purpose: the panel outlives the settings card's React tree and must survive
 * shell re-renders with the same self-healing pattern the family uses.
 *
 * The panel always shows *the conversation you are in*: the session id comes
 * from the dsh client's persisted selection (`localStorage['dsh.sessions.current']`,
 * written by the session controller on every switch) and the title from
 * `document.title` (the layout layer projects the current session title there,
 * suffixed with ` — <product>`). Toggling writes the same per-conversation JSON
 * the settings page and the `skill_select` tool write, so all three always agree.
 * @module
 */
/** Mount the sidebar entry with the family's self-healing pattern. */
export declare function mountSidebarEntry(ctx: {
    effect: (run: () => () => void, label?: string) => () => void;
}): void;
//# sourceMappingURL=sidebar.d.ts.map