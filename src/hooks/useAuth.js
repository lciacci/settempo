import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { describeError, notify } from '../lib/notify'

export function useAuth() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Both of these keep returning { error } so AuthModal's contract is
  // unchanged, but a thrown rejection (network dropped mid-request) is
  // normalised into that same shape instead of escaping as an unhandled
  // rejection, and every failure is classified and logged.
  const signIn = async (email) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href.split(/[?#]/)[0] },
      })
      if (error) {
        const detail = describeError(error)
        notify(`SIGN-IN FAILED · ${detail}`, 'error')
        return { error: { ...error, message: detail } }
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
      const { error } = await supabase.auth.signOut()
      if (error) {
        notify(`DISCONNECT FAILED · ${describeError(error)}`, 'error')
        return { error }
      }
      notify('DISCONNECTED', 'ok')
      return { error: null }
    } catch (err) {
      notify(`DISCONNECT FAILED · ${describeError(err)}`, 'error')
      return { error: { message: describeError(err) } }
    }
  }

  return { session, loading: session === undefined, signIn, signOut }
}
