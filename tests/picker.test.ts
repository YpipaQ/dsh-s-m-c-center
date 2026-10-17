/**
 * Classification of the host's directory-picker failures.
 *
 * A host that composes the `browse` backend has no OS dialog, and the settings
 * page must stop offering a button that cannot work — but only for that case.
 * A cancelled dialog and a genuine wire failure have to stay ordinary errors,
 * or the page would silently hide a real problem behind a "paste the path"
 * hint.
 */
import { describe, expect, it } from 'vitest'
import {
  PickerUnavailableError, isPickerUnavailable, pickFailureState, pickFromResult,
} from '../src/client/shared/picker.ts'

describe('directory picker classification', () => {
  it('recognises the marker the host-unavailable path throws', () => {
    expect(isPickerUnavailable(new PickerUnavailableError())).toBe(true)
  })

  it('leaves ordinary failures alone', () => {
    expect(isPickerUnavailable(new Error('directory picker was aborted'))).toBe(false)
    expect(isPickerUnavailable(new Error('directory picker failed: boom'))).toBe(false)
  })

  it('does not classify by message or by bare value', () => {
    expect(isPickerUnavailable('directory-picker/unavailable')).toBe(false)
    expect(isPickerUnavailable({ code: 'directory-picker/unavailable' })).toBe(false)
    expect(isPickerUnavailable(null)).toBe(false)
    expect(isPickerUnavailable(undefined)).toBe(false)
  })

  it('keeps a recognisable name for logs', () => {
    expect(new PickerUnavailableError().name).toBe('PickerUnavailableError')
  })

  it('maps the unavailable marker onto the hint state, not an error', () => {
    // The hint replaces the red text: this is an environment property, and an
    // English wire message is not advice the operator can act on.
    expect(pickFailureState(new PickerUnavailableError())).toEqual({ pickerUnavailable: true, error: '' })
  })

  it('leaves an ordinary failure as an ordinary error', () => {
    expect(pickFailureState(new Error('boom'))).toEqual({ error: 'boom' })
    // Crucially it does not carry `pickerUnavailable: false`: the merge must
    // not re-enable a button that a previous round already latched off.
    expect('pickerUnavailable' in pickFailureState(new Error('boom'))).toBe(false)
  })
})

describe('pick result mapping', () => {
  it('returns the chosen path', () => {
    expect(pickFromResult({ ok: true, value: '/home/me/skills' })).toBe('/home/me/skills')
  })

  it('returns null when the operator cancelled', () => {
    expect(pickFromResult({ ok: true, value: null })).toBe(null)
  })

  it('maps a browse-only host to the marker instead of an English wire failure', () => {
    // This is the Linux/remote case: the host has no OS dialog and refuses.
    expect(() => pickFromResult({
      ok: false,
      error: {
        code: 'directory-picker/unavailable',
        message: 'directoryPicker.pick needs the native capability; the composed picker serves "browse"',
      },
    })).toThrow(PickerUnavailableError)
  })

  it('keeps a genuine failure as a failure', () => {
    expect(() => pickFromResult({
      ok: false,
      error: { code: 'gateway/internal', message: 'boom' },
    })).toThrow('directory picker failed: boom')
  })
})
