import { useEffect, useState } from 'react'
import { neon, toSession } from '../lib/neon'
import { describeError, notify } from '../lib/notify'

// Email OTP rather than magic link. A magic link is a redirect flow: the user
// leaves the app, opens Mail, and taps a link that iOS hands to Safari — not
// to the installed standalone PWA. They end up signed in inside a browser tab
// while the app on their home screen is still signed out. A typed code never
// leaves the app, so the installed context survives.

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
        const { data, error } = await neon.auth.getSession()
        if (cancelled) return
        // A failed session check is not the same as being signed out.
        // Swallowing `error` here would render the signed-out UI on a network
        // blip and quietly discard the user's session state.
        if (error) {
          notify(`SESSION CHECK FAILED · ${describeError(error)}`, 'error')
          setSession(null)
          return
        }
        setSession(toSession(data))
      } catch (err) {
        if (cancelled) return
        notify(`SESSION CHECK FAILED · ${describeError(err)}`, 'error')
        setSession(null)
      }
    }

    // Re-check when the tab regains focus, so a session established elsewhere
    // (or one that expired while backgrounded) is picked up without a reload.
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

  // All three return { error } so callers branch on one shape, and a thrown
  // rejection is normalised into it rather than escaping unhandled.
  const sendCode = async (email) => {
    try {
      const { error } = await neon.auth.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      })
      if (error) {
        const detail = describeError(error)
        notify(`CODE REQUEST FAILED · ${detail}`, 'error')
        return { error: { message: detail } }
      }
      notify(`CODE SENT · ${email.toUpperCase()}`, 'ok')
      return { error: null }
    } catch (err) {
      const detail = describeError(err)
      notify(`CODE REQUEST FAILED · ${detail}`, 'error')
      return { error: { message: detail } }
    }
  }

  const verifyCode = async (email, otp) => {
    try {
      const { data, error } = await neon.auth.signIn.emailOtp({ email, otp })
      if (error) {
        const detail = describeError(error)
        notify(`SIGN-IN FAILED · ${detail}`, 'error')
        return { error: { message: detail } }
      }
      // Adopt the session immediately rather than waiting for the next
      // visibility check — this is an in-app transition, not a redirect.
      //
      // Read it back rather than trusting the sign-in response shape: if it
      // ever differs from getSession()'s, trusting it would show a success
      // toast while leaving the app signed out. Falls back to the response
      // if the read-back fails for any reason.
      let next = toSession(data)
      try {
        const { data: current } = await neon.auth.getSession()
        next = toSession(current) ?? next
      } catch {
        // Keep whatever sign-in returned; the visibility check will correct it.
      }
      setSession(next)
      notify('AUTHENTICATED', 'ok')
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

  return { session, loading: session === undefined, sendCode, verifyCode, signOut }
}
