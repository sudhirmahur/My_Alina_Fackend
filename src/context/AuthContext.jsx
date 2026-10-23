import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthLost } from '../lib/api'
import { getRefresh } from '../lib/session'
import { auth } from '../services'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(getRefresh() ? 'loading' : 'anon') // loading | authed | anon

  useEffect(() => {
    onAuthLost(() => { setUser(null); setStatus('anon') })
    if (!getRefresh()) return undefined
    let alive = true
    auth.me()
      .then((u) => { if (alive) { setUser(u); setStatus('authed') } })
      .catch((err) => {
        // Only drop the session when the server says it's invalid; keep it on network errors.
        if (!alive) return
        if (err?.status === 401 || err?.status === 403) setStatus('anon')
        else setStatus('offline')
      })
    return () => { alive = false }
  }, [])

  const login = useCallback(async (body) => { const u = await auth.login(body); setUser(u); setStatus('authed'); return u }, [])
  const register = useCallback(async (body) => { const u = await auth.register(body); setUser(u); setStatus('authed'); return u }, [])
  const logout = useCallback(async (all = false) => { await auth.logout(all); setUser(null); setStatus('anon') }, [])
  const retry = useCallback(() => {
    setStatus('loading')
    auth.me().then((u) => { setUser(u); setStatus('authed') })
      .catch((e) => setStatus(e?.status === 401 || e?.status === 403 ? 'anon' : 'offline'))
  }, [])

  const value = useMemo(() => ({ user, setUser, status, login, register, logout, retry }), [user, status, login, register, logout, retry])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
