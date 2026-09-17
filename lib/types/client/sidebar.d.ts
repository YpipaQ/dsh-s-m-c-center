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
/** Mount the sidebar entry with the family's self-healing pattern. */
export declare function mountSidebarEntry(ctx: {
    effect: (run: () => () => void, label?: string) => () => void;
}): void;
//# sourceMappingURL=sidebar.d.ts.map