import { useAppStore } from '../store/useAppStore'

// Non-React entry point to the system log, so plain async helpers can report
// without being hooks. Components can use the store directly instead.
export const notify = (text, level = 'info') =>
  useAppStore.getState().notify(text, level)

// ── Error classification ──────────────────────────────────────────────────
// Async failures in this app arrive from three places that a user needs to
// tell apart, because the remedy differs: the local store, the network, and
// the backend rejecting the request. A bare `err.message` collapses all three
// into noise like "Failed to fetch".

export function describeError(err) {
  if (!err) return 'UNKNOWN FAILURE'

  const name = String(err.name ?? '')
  const message = String(err.message ?? err)

  // Local store. This is the shape the un-migratable v3 schema produced —
  // every call rejecting against a database that never opened.
  if (name === 'DatabaseClosedError' || name === 'UpgradeError' || name === 'VersionError')
    return 'LOCAL STORE UNAVAILABLE — RELOAD TO REBUILD'
  if (name === 'QuotaExceededError')
    return 'DEVICE STORAGE FULL — FREE SPACE AND RETRY'
  if (name === 'DataError' || name === 'ConstraintError')
    return `LOCAL WRITE REJECTED: ${message}`

  // Network. Check offline first: it explains a fetch failure better than the
  // fetch failure does.
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return 'OFFLINE — CHANGES SAVED LOCALLY, SYNC WHEN RECONNECTED'
  if (name === 'TypeError' && /fetch|network/i.test(message))
    return 'NETWORK UNREACHABLE — BACKEND DID NOT RESPOND'

  // Auth.
  if (/jwt|token|unauthor|not authenticated|invalid login|expired/i.test(message))
    return `AUTH FAILURE: ${message}`

  // Data / validation, and anything else that at least carries a real message.
  return `FAILURE: ${message}`
}

// ── Guarded async action ──────────────────────────────────────────────────
// The defect class this exists to close: every state-changing click handler
// in this app was an async function wired straight to onClick with no catch,
// so a rejection produced literal silence. Rather than bolt a try/catch onto
// each call site, route them through here — one place that guarantees both
// halves of the contract: a success is confirmed, a failure is named.
//
// Returns { ok, result } / { ok, error } so callers can branch without
// needing their own try/catch.

export async function attempt(action, { success, failure } = {}) {
  try {
    const result = await action()
    if (success) {
      notify(typeof success === 'function' ? success(result) : success, 'ok')
    }
    return { ok: true, result }
  } catch (error) {
    const prefix = failure ? `${failure} · ` : ''
    notify(`${prefix}${describeError(error)}`, 'error')
    // Keep the raw error in the console for debugging; the log entry above is
    // the user-facing half.
    console.error(failure ?? 'action failed', error)
    return { ok: false, error }
  }
}
