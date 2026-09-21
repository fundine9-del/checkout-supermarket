import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { createApi, type Api } from '../lib/api'
import type { Supermarket } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  store: Supermarket | null
  storeLoading: boolean
  api: Api | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  createStore: (name: string) => Promise<Supermarket>
  signOut: () => Promise<void>
  refreshStore: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<Supermarket | null>(null)
  const [storeLoading, setStoreLoading] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const refreshStore = useCallback(async () => {
    const s = await supabase.auth.getSession()
    const token = s.data.session?.access_token
    if (!token) {
      setStore(null)
      return
    }
    // (post-await, so no synchronous setState from within effects)
    setStoreLoading(true)
    try {
      const { supermarket } = await createApi(token).mySupermarket()
      setStore(supermarket)
    } catch {
      setStore(null) // signed in but no supermarket registered yet
    } finally {
      setStoreLoading(false)
    }
  }, [])

  useEffect(() => {
    // fetch-on-mount: load the store for the (possibly changing) session.
    // State updates happen after awaits inside refreshStore, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) void refreshStore()
  }, [session, refreshStore])

  const api = useMemo(() => (session ? createApi(session.access_token) : null), [session])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) throw error
      const session = data.session
      const needsEmailConfirm = session === null
      if (!needsEmailConfirm && data.user && session) {
        // session is active immediately (email confirmation disabled) -> register store
        try {
          await createApi(session.access_token).createSupermarket(name)
          await refreshStore()
        } catch (err) {
          console.warn('Store registration failed:', err)
        }
      }
      return { needsEmailConfirm }
    },
    [refreshStore],
  )

  const createStore = useCallback(
    async (name: string) => {
      const s = await supabase.auth.getSession()
      const token = s.data.session?.access_token
      if (!token) throw new Error('Not signed in')
      const { supermarket } = await createApi(token).createSupermarket(name)
      setStore(supermarket)
      return supermarket
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setStore(null)
  }, [])

  const value: AuthContextValue = {
    session,
    loading,
    store,
    storeLoading,
    api,
    signIn,
    signUp,
    createStore,
    signOut,
    refreshStore,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider belong together
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}