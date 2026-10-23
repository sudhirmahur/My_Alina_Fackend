import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brain, FileText, Home, Image, LayoutGrid, ListChecks, MessageCircle, Mic, Settings } from './icons'
import { Avatar } from './ui'
import { cx } from '../lib/cx'
import { useAuth } from '../context/AuthContext'
import useReminderWatcher from '../hooks/useReminderWatcher'

const MORE_PATHS = ['/more', '/routine', '/files', '/images', '/memory', '/settings']

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/voice', label: 'Voice', icon: Mic, hero: true },
  { to: '/more', label: 'More', icon: LayoutGrid, matches: MORE_PATHS },
]

const SIDE = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/voice', label: 'Voice', icon: Mic },
  { to: '/routine', label: 'Daily routine', icon: ListChecks },
  { to: '/files', label: 'Files', icon: FileText },
  { to: '/images', label: 'Images', icon: Image },
  { to: '/memory', label: 'Memory', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar() {
  const { user } = useAuth()
  return (
    <aside className="pt-safe sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/60 p-4 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-2 py-3">
        <Avatar size={44} pulse={false} />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold leading-none">Alina</p>
          <p className="mt-1 truncate text-xs text-muted">{user?.display_name || user?.email}</p>
        </div>
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-1" aria-label="Main">
        {SIDE.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cx('flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.95rem] font-medium transition',
              isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-raised/60 hover:text-ink')}>
            <Icon className="size-5" />{label}
          </NavLink>
        ))}
      </nav>
      <p className="px-3 pb-2 text-[0.7rem] leading-snug text-muted">Your voice. Your world. Your AI.</p>
    </aside>
  )
}

function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid h-[4.25rem] max-w-md grid-cols-4 items-center px-2">
        {TABS.map(({ to, label, icon: Icon, end, hero, matches }) => {
          const active = matches ? matches.some((m) => pathname.startsWith(m)) : end ? pathname === to : pathname.startsWith(to)
          return (
            <li key={to}>
              <NavLink to={to} end={end} aria-current={active ? 'page' : undefined}
                className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl transition active:scale-95">
                {hero ? (
                  <span className={cx('grid size-11 place-items-center rounded-2xl transition',
                    active ? 'bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--accent)]' : 'bg-raised text-accent')}>
                    <Icon className="size-5" />
                  </span>
                ) : (
                  <Icon className={cx('size-[1.4rem] transition', active ? 'text-accent' : 'text-muted')} />
                )}
                <span className={cx('text-[0.68rem] font-medium', active ? 'text-accent' : 'text-muted', hero && 'sr-only')}>{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default function AppShell() {
  const { pathname } = useLocation()
  useReminderWatcher()
  const immersive = /^\/chat\/[^/]+/.test(pathname) // a conversation is full-screen on phones
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <Sidebar />
      <div className={cx('flex min-h-dvh min-w-0 flex-col', !immersive && 'pb-[var(--nav-h)] lg:pb-0')}>
        <Outlet />
      </div>
      {!immersive && <BottomNav />}
    </div>
  )
}
