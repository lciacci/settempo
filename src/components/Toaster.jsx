import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

// Transient surface for the system log. Every toast here is also a permanent
// entry in the SYSTEM LOG panel in Settings, so a missed toast is never lost
// information — it is just information the user has to go and read.
//
// Errors do not auto-dismiss. A failure the user blinked past is the exact
// problem this whole layer exists to fix.
const DISMISS_AFTER_MS = 4000

const LEVEL_STYLES = {
  ok:    { dot: 'bg-primary glow-bulb',   text: 'text-primary',    label: 'OK' },
  error: { dot: 'bg-error',               text: 'text-error',      label: 'FAULT' },
  info:  { dot: 'bg-secondary',           text: 'text-on-surface', label: 'INFO' },
}

function Toast({ entry, dismiss }) {
  const style = LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info

  // Depends on the entry's identity and the store's stable action, not on a
  // freshly-allocated closure — otherwise every new toast re-runs this effect
  // for all the others and restarts their timers.
  useEffect(() => {
    if (entry.level === 'error') return
    const t = setTimeout(() => dismiss(entry.id), DISMISS_AFTER_MS)
    return () => clearTimeout(t)
  }, [entry.id, entry.level, dismiss])

  const onDismiss = () => dismiss(entry.id)

  return (
    <div className="brushed-metal rack-panel rounded-sm bg-surface-container-low border border-outline-variant/30 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)] pointer-events-auto">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${style.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="font-mono-digital text-[8px] tracking-[0.3em] text-outline uppercase mb-0.5">
            {style.label}
          </p>
          <p className={`font-mono-digital text-[10px] leading-relaxed uppercase tracking-wide break-words ${style.text}`}>
            {entry.text}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-outline hover:text-primary transition-colors flex-shrink-0 -mt-0.5"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  )
}

export default function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-[60] space-y-2 pointer-events-none">
      {toasts.map((entry) => (
        <Toast key={entry.id} entry={entry} dismiss={dismissToast} />
      ))}
    </div>
  )
}
