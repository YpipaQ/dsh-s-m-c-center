/**
 * The host's directory picker, classified for the settings page.
 *
 * `ctx.remote.directoryPicker.pick` needs the host's *native* chooser. A host
 * that composes the `browse` backend instead — a remote/Linux deployment — can
 * list and create directories for an in-app browser, but has no OS dialog to
 * open, and answers `directory-picker/unavailable` rather than pretending.
 *
 * That is an environment property, not a failure: the page should stop offering
 * a button that cannot work and say what to do instead. Recognising it needs a
 * discriminator, not a message match on English prose, so the classification
 * lives here and both sides import it.
 * @module
 */

import { errorText } from './format.ts'

/** The host has no native chooser; the operator must type the path. */
export class PickerUnavailableError extends Error {
  constructor() {
    super('directory picker is unavailable in this environment')
    this.name = 'PickerUnavailableError'
  }
}

/**
 * Whether a failure means "this host cannot open a chooser".
 * @param error - anything thrown by the pick path.
 * @returns true for our marker error, and only for it.
 */
export function isPickerUnavailable(error: unknown): error is PickerUnavailableError {
  return error instanceof PickerUnavailableError
}

/** The part of the scan state a failed pick changes. */
export interface PickFailureState {
  /** Present (and true) only when the host cannot open a chooser. */
  pickerUnavailable?: true
  /** Operator-facing failure text ('' when the hint replaces it). */
  error: string
}

/**
 * Map a failed pick onto the scan state.
 *
 * `pickerUnavailable` is only ever *added*, never cleared: a host that has no
 * chooser will not grow one, so a later ordinary failure must not re-enable a
 * button that cannot work.
 * @param error - whatever the pick path rejected with.
 * @returns the fields to merge into the scan state.
 */
export function pickFailureState(error: unknown): PickFailureState {
  if (isPickerUnavailable(error)) return { pickerUnavailable: true, error: '' }
  return { error: errorText(error) }
}

/** As much of a Remote result as this module needs; the real one also carries details. */
type PickResult =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * Turn the host's `pick` result into this page's value-or-throw contract.
 *
 * The host refuses `pick` with `directory-picker/unavailable` when it composed
 * the browse backend — a remote/Linux host has `list` and `createDirectory` for
 * an in-app browser, but no OS dialog. That refusal is an environment fact, so
 * it gets a distinguishable type; every other refusal is a real failure and
 * keeps its own message.
 * @param result - what `remote.directoryPicker.pick()` resolved to.
 * @returns the chosen absolute path, or null when the operator cancelled.
 * @throws PickerUnavailableError when this host has no native chooser.
 */
export function pickFromResult(result: PickResult): string | null {
  if (result.ok) return result.value
  if (result.error.code === 'directory-picker/unavailable') throw new PickerUnavailableError()
  throw new Error(`directory picker failed: ${result.error.message}`)
}
