import { useState } from 'react'

function formatLastSynced(ts) {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function AuthModal({ session, onSignIn, onSignOut, onClose, onSync, syncState, lastSynced, syncError }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const handleSend = async () => {
    if (!email.trim()) return
    setStatus('sending')
    setErrorMsg('')
    const { error } = await onSignIn(email.trim())
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  const handleSignOut = async () => {
    await onSignOut()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low brushed-metal rack-panel rounded-lg w-full max-w-sm relative overflow-hidden">
        <div className="absolute top-3 left-3"><div className="screw-head" /></div>
        <div className="absolute top-3 right-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 left-3"><div className="screw-head" /></div>
        <div className="absolute bottom-3 right-3"><div className="screw-head" /></div>

        {/* Header */}
        <div className="border-b border-outline-variant/20 px-8 pt-6 pb-4 flex items-start justify-between">
          <div>
            <p className="font-mono-digital text-[9px] text-outline uppercase tracking-[0.4em]">Account</p>
            <h3 className="font-headline font-black text-primary uppercase tracking-tight text-2xl">
              {session ? 'Sync Node' : 'Connect'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-outline hover:text-primary transition-colors rounded mt-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-8 py-6 space-y-5">
          {session ? (
            /* ── Signed-in state ── */
            <>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary-container shadow-[0_0_8px_#FFB300] flex-shrink-0" />
                <div>
                  <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">Authenticated</p>
                  <p className="font-label text-sm text-on-surface font-semibold mt-0.5">{session.user.email}</p>
                </div>
              </div>

              {/* Sync status */}
              <div className="bg-surface-container-high border border-outline-variant/20 rounded-sm px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono-digital text-[9px] text-outline uppercase tracking-widest">Last Sync</p>
                    <p className={`font-mono-digital text-[10px] mt-0.5 ${syncState === 'error' ? 'text-error' : 'text-on-surface'}`}>
                      {syncState === 'error' ? syncError : formatLastSynced(lastSynced)}
                    </p>
                  </div>
                  {syncState === 'syncing' && (
                    <span className="material-symbols-outlined text-primary text-base animate-spin">sync</span>
                  )}
                  {syncState === 'done' && (
                    <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
                  )}
                  {syncState === 'error' && (
                    <span className="material-symbols-outlined text-error text-base">error</span>
                  )}
                </div>
                <button
                  onClick={onSync}
                  disabled={syncState === 'syncing'}
                  className="w-full py-2 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  {syncState === 'syncing' ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full py-2.5 border border-outline-variant/20 text-outline hover:text-error hover:border-error/40 font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : status === 'sent' ? (
            /* ── Link sent state ── */
            <>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#9bd2b7] flex-shrink-0" />
                <p className="font-mono-digital text-[9px] text-secondary uppercase tracking-widest">Signal Transmitted</p>
              </div>
              <div className="bg-surface-container-high border border-outline-variant/20 rounded-sm px-4 py-4 space-y-2">
                <p className="font-mono-digital text-[10px] text-on-surface uppercase tracking-wide">
                  Link sent to:
                </p>
                <p className="font-label text-sm text-primary font-semibold">{email}</p>
                <p className="font-mono-digital text-[9px] text-outline uppercase tracking-wide leading-relaxed mt-2">
                  Click the link in your email to sign in. You can close this panel.
                </p>
              </div>
              <button
                onClick={() => { setStatus('idle'); setEmail('') }}
                className="w-full py-2.5 border border-outline-variant/20 text-outline hover:text-on-surface font-mono-digital text-[10px] uppercase tracking-widest rounded-sm transition-colors"
              >
                Send to different address
              </button>
            </>
          ) : (
            /* ── Idle / error state ── */
            <>
              <p className="font-mono-digital text-[9px] text-outline uppercase tracking-wide leading-relaxed">
                Enter your email to receive a sign-in link. No password required.
              </p>
              <div className="space-y-3">
                <input
                  autoFocus
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-label text-sm px-3 py-2.5 rounded-sm outline-none focus:border-primary/60 placeholder:text-outline/40"
                />
                {status === 'error' && (
                  <p className="font-mono-digital text-[9px] text-error uppercase tracking-wide">{errorMsg}</p>
                )}
                <button
                  onClick={handleSend}
                  disabled={status === 'sending' || !email.trim()}
                  className="w-full py-2.5 bg-primary-container text-on-primary font-headline font-black text-[10px] uppercase tracking-widest rounded-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? 'Transmitting…' : 'Send Link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
