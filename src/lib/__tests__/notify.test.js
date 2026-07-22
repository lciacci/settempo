import { describe, it, expect, beforeEach, vi } from 'vitest'
import { attempt, describeError, notify } from '../notify'
import { useAppStore } from '../../store/useAppStore'

const logTexts = () => useAppStore.getState().systemLog.map((e) => e.text)
const toastTexts = () => useAppStore.getState().toasts.map((e) => e.text)

beforeEach(() => {
  useAppStore.setState({ systemLog: [], toasts: [], logSeq: 1 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('describeError', () => {
  it('names a closed local store rather than leaking the Dexie message', () => {
    const err = Object.assign(new Error('UpgradeError ...'), { name: 'DatabaseClosedError' })
    expect(describeError(err)).toMatch(/LOCAL STORE UNAVAILABLE/)
  })

  it('distinguishes auth failure from network failure', () => {
    const auth = describeError(new Error('Invalid login credentials'))
    const network = describeError(Object.assign(new TypeError('Failed to fetch'), {}))
    expect(auth).toMatch(/AUTH FAILURE/)
    expect(network).toMatch(/NETWORK UNREACHABLE/)
    expect(auth).not.toBe(network)
  })

  it('prefers the offline explanation over the fetch failure it causes', () => {
    const original = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/OFFLINE/)
    Object.defineProperty(navigator, 'onLine', { value: original, configurable: true })
  })

  it('never returns an empty description', () => {
    expect(describeError(null)).toBeTruthy()
    expect(describeError(new Error(''))).toBeTruthy()
  })
})

describe('attempt', () => {
  it('confirms success and returns the result', async () => {
    const r = await attempt(async () => 42, { success: 'DONE' })
    expect(r).toEqual({ ok: true, result: 42 })
    expect(logTexts()).toContain('DONE')
  })

  it('builds the success message from the result when given a function', async () => {
    await attempt(async () => ({ added: 3 }), { success: (c) => `ADDED ${c.added}` })
    expect(logTexts()).toContain('ADDED 3')
  })

  it('names a failure instead of swallowing it, and does not rethrow', async () => {
    const r = await attempt(async () => { throw new Error('boom') }, { failure: 'SAVE FAILED' })
    expect(r.ok).toBe(false)
    expect(logTexts()[0]).toMatch(/SAVE FAILED · FAILURE: boom/)
  })

  it('stays silent on success when no message is given', async () => {
    await attempt(async () => 1)
    expect(logTexts()).toHaveLength(0)
  })
})

describe('toast stack', () => {
  it('keeps every occurrence in the log but only one toast per message', () => {
    // The offline auto-sync loop: same error, once a minute, forever.
    notify('SYNC FAILED · OFFLINE', 'error')
    notify('SYNC FAILED · OFFLINE', 'error')
    notify('SYNC FAILED · OFFLINE', 'error')

    expect(logTexts()).toHaveLength(3)
    expect(toastTexts()).toEqual(['SYNC FAILED · OFFLINE'])
  })

  it('caps the visible stack so it cannot cover the screen', () => {
    for (let i = 0; i < 10; i++) notify(`EVENT ${i}`, 'error')
    expect(toastTexts()).toHaveLength(3)
    expect(logTexts()).toHaveLength(10)
  })
})
