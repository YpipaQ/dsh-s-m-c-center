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

/**
 * A tile at least this many pixels on both sides reads as a block rather than
 * as an icon. Below it, a square is just a small glyph.
 */
const BIG_SQUARE_MIN = 28

/**
 * How far from square such a tile may be and still read as a block. Two pixels
 * of border and padding routinely separate a 32px tile's sides; a 1.35 ratio
 * admits those without admitting an obvious rectangle.
 */
const BIG_SQUARE_RATIO = 1.35

/** The two dimensions this rule cares about, in CSS pixels. */
export interface Box {
  readonly width: number
  readonly height: number
}

/**
 * Whether a neighbouring action reads as a large square tile.
 * @param box - the neighbour's measured box.
 * @returns true when it is big on both sides and roughly square.
 */
export function isBigSquareIcon(box: Box): boolean {
  const short = Math.min(box.width, box.height)
  const long = Math.max(box.width, box.height)
  return short >= BIG_SQUARE_MIN && long <= short * BIG_SQUARE_RATIO
}

/**
 * Where our row belongs relative to the neighbouring action.
 *
 * -1 and 1 rather than a boolean because the caller writes them straight into
 * `order`, where they mean "before" and "after" along the stacked axis.
 * @param other - the neighbour's box, or undefined when we are alone in the seat.
 * @returns -1 above it, 1 below it, 0 when the question does not arise.
 */
export function footerActionOrder(other: Box | undefined): -1 | 0 | 1 {
  if (other === undefined) return 0
  return isBigSquareIcon(other) ? -1 : 1
}

/**
 * Apply the rule to a live row.
 *
 * The row must be the element the shell lays out in the seat — the direct child
 * of the slot container. Its siblings there are the other actions, whoever
 * registered them: this plugin has no idea which packages share the foot, and
 * does not need to.
 * @param row - our row.
 */
export function placeFooterAction(row: HTMLElement): void {
  const slot = row.parentElement
  const other = slot === null ? undefined : Array.from(slot.children).find((el) => el !== row)
  const order = footerActionOrder(other?.getBoundingClientRect())
  if (order === 0) row.style.removeProperty('order')
  else row.style.order = String(order)
}
