/**
 * Our place among the sidebar footer's actions.
 *
 * `sidebar.footer.action` is a `list` seat, but the shell renders its occupants
 * on a single flex line — and two of them that each want the full column cannot
 * share one line: they split it and both read as truncated labels. The entry's
 * stylesheet folds that line into a stack; this module decides our place in it.
 *
 * The rule is a product decision, not an inference. A *large square tile* beside
 * us is something the eye reads as a block, so our row goes above it and the
 * block keeps the bottom, next to Settings. Anything else — a compact icon, or
 * a row that is merely wide — is lighter than our own row, so ours goes below.
 *
 * Kept apart from the component (and from the DOM) so the boundary can be
 * pinned by tests instead of by eye.
 * @module
 */
/** The two dimensions this rule cares about, in CSS pixels. */
export interface Box {
    readonly width: number;
    readonly height: number;
}
/**
 * Whether a neighbouring action reads as a large square tile.
 * @param box - the neighbour's measured box.
 * @returns true when it is big on both sides and roughly square.
 */
export declare function isBigSquareIcon(box: Box): boolean;
/**
 * Where our row belongs relative to the neighbouring action.
 *
 * -1 and 1 rather than a boolean because the caller writes them straight into
 * `order`, where they mean "before" and "after" along the stacked axis.
 * @param other - the neighbour's box, or undefined when we are alone in the seat.
 * @returns -1 above it, 1 below it, 0 when the question does not arise.
 */
export declare function footerActionOrder(other: Box | undefined): -1 | 0 | 1;
/**
 * Apply the rule to a live row.
 *
 * The row must be the element the shell lays out in the seat — the direct child
 * of the slot container. Its siblings there are the other actions, whoever
 * registered them: this plugin has no idea which packages share the foot, and
 * does not need to.
 * @param row - our row.
 */
export declare function placeFooterAction(row: HTMLElement): void;
//# sourceMappingURL=footer-slot.d.ts.map