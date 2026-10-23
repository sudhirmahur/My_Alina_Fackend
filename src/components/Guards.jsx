import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { WifiOff } from './icons'
import { Avatar, Button } from './ui'
import { useAuth } from '../context/AuthContext'

export function Splash({ label = 'Waking Alina up…' }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-5">
        <Avatar size={96} glow pulse />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}

export function RequireAuth() {
  const { status, retry } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'offline') {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="flex max-w-xs flex-col items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-warn/15 text-warn"><WifiOff className="size-7" /></span>
          <h1 className="font-display text-xl font-semibold">Can’t reach Alina’s server</h1>
          <p className="text-sm text-muted">Check your connection, and that the backend is running. You’re still signed in.</p>
          <Button onClick={retry}>Try again</Button>
        </div>
      </div>
    )
  }
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <Outlet />
}

export function PublicOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <Splash />
  if (status === 'authed') return <Navigate to="/" replace />
  return <Outlet />
}
