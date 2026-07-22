import { useEffect, useState } from 'react'
import { neon, toSession } from '../lib/neon'
import { describeError, notify } from '../lib/notify'

export function useAuth() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // `cancelled` guards against resolving into an unmounted component, which
    // is also what keeps this off the wrong side of react-hooks/
    // set-state-in-effect: the write happens in an async continuation the
    // effect can disown, not in its body.
    let cancelled = false

    const refresh = async () => {
      try {
        const { data } = await neon.auth.getSession()
        if (!cancelled) setSession(toSession(data))
      } catch (err) {
        if (cancelled) return
        notify(`SESSION CHECK FAILED · ${describeError(err)}`, 'error')
        setSession(null)
      }
    }

    // Magic link completes as a full page navigation back to callbackURL, so
    // this mount-time read is what actually picks up a new sign-in — there is
    // no in-page auth event to subscribe to. The visibility check covers the
    // link being opened in another tab, which would otherwise leave this one
    // sitting signed-out until reload.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Both of these return { error } so AuthModal's contract is unchanged from
  // the Supabase implementation, and a thrown rejection is normalised into
  // that same shape rather than escaping as an unhandled rejection.
  const signIn = async (email) => {
    try {
      // Return to the page the user started from, minus any query or hash —
      // the same redirect target the Supabase implementation used.
      const callbackURL = window.location.href.split(/[?#]/)[0]
      const { error } = await neon.auth.signIn.magicLink({ email, callbackURL })
      if (error) {
        const detail = describeError(error)
        notify(`SIGN-IN FAILED · ${detail}`, 'error')
        return { error: { message: detail } }
      }
      notify(`SIGN-IN LINK SENT · ${email.toUpperCase()}`, 'ok')
      return { error: null }
    } catch (err) {
      const detail = describeError(err)
      notify(`SIGN-IN FAILED · ${detail}`, 'error')
      return { error: { message: detail } }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await neon.auth.signOut()
      if (error) {
        notify(`DISCONNECT FAILED · ${describeError(error)}`, 'error')
        return { error }
      }
      setSession(null)
      notify('DISCONNECTED', 'ok')
      return { error: null }
    } catch (err) {
      const detail = describeError(err)
      notify(`DISCONNECT FAILED · ${detail}`, 'error')
      return { error: { message: detail } }
    }
  }

  return { session, loading: session === undefined, signIn, signOut }
}
