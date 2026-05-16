import { useCallback, useEffect, useRef, useState } from 'react'
import { runSync, getLastSyncedAt } from '../lib/sync'

// Polling interval. Chosen to be conservative: PWA, mostly idle. Push/pull
// already runs on session change and tab focus, so this is the safety net.
const SYNC_INTERVAL_MS = 60_000

export function useSyncEngine(session) {
  const userId = session?.user?.id

  const [syncState, setSyncState] = useState('idle') // 'idle' | 'syncing' | 'done' | 'error'
  const [syncedAt, setSyncedAt] = useState(null)
  const [syncError, setSyncError] = useState(null)

  // Prevents overlapping runs when several triggers fire close together
  // (e.g. login + window-focus on resume from background).
  const runningRef = useRef(false)

  const lastSynced = syncedAt ?? (userId ? getLastSyncedAt(userId) || null : null)

  const sync = useCallback(async () => {
    if (!userId) return
    if (runningRef.current) return
    runningRef.current = true
    setSyncState('syncing')
    setSyncError(null)
    try {
      const ts = await runSync(userId)
      setSyncedAt(ts)
      setSyncState('done')
    } catch (e) {
      setSyncError(e.message)
      setSyncState('error')
    } finally {
      runningRef.current = false
    }
  }, [userId])

  // Auto-sync triggers: login, tab focus, network back online, and an idle
  // interval. The interval is the safety net for long-lived sessions where
  // the tab stays visible — most syncs go through the other three.
  useEffect(() => {
    if (!userId) return

    sync()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const onOnline = () => sync()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    const interval = setInterval(sync, SYNC_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      clearInterval(interval)
    }
  }, [userId, sync])

  return { sync, syncState, lastSynced, syncError }
}
