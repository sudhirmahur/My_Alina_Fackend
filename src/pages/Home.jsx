import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, Brain, CalendarDays, ChevronRight, FileText, Image, ListChecks, MessageCircle, Mic, Settings } from '../components/icons'
import { Avatar, Badge, Button, Card, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import useResource from '../hooks/useResource'
import { cx } from '../lib/cx'
import { formatDate, formatDateTime, greeting, isToday, relativeTime } from '../lib/format'
import { ai, chats, reminders, tasks } from '../services'

const QUICK = [
  { to: '/files', label: 'Files', hint: 'Ask your documents', icon: FileText },
  { to: '/routine', label: 'Tasks', hint: 'Today’s routine', icon: ListChecks },
  { to: '/memory', label: 'Memory', hint: 'What I remember', icon: Brain },
  { to: '/images', label: 'Images', hint: 'Your gallery', icon: Image },
]

export default function Home() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { timezone } = useSettings()
  const status = useResource(() => ai.status(), [])
  const recent = useResource(() => chats.list({ page_size: 3, archived: false }), [])
  const todo = useResource(() => tasks.list({ status: 'todo', sort_by: 'due_at', order: 'asc', page_size: 50 }), [])
  const rem = useResource(() => reminders.list({ status: 'scheduled', page_size: 50 }), [])

  const now = new Date()
  const name = user?.display_name?.split(' ')[0]
  const today = [
    ...(rem.data?.items || []).filter((r) => isToday(r.next_fire_at || r.scheduled_at, timezone))
      .map((r) => ({ id: `r${r.id}`, kind: 'reminder', title: r.title, at: r.next_fire_at || r.scheduled_at })),
    ...(todo.data?.items || []).filter((t) => t.due_at && (isToday(t.due_at, timezone) || new Date(t.due_at) < now))
      .map((t) => ({ id: `t${t.id}`, kind: 'task', title: t.title, at: t.due_at, overdue: new Date(t.due_at) < now && !isToday(t.due_at, timezone) })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at)).slice(0, 4)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-safe">
      <section className="rise flex flex-col items-center pb-2 pt-10 text-center sm:pt-14">
        <div className="float"><Avatar size={132} glow /></div>
        <p className="mt-7 text-sm text-muted">{formatDate(now.toISOString(), timezone, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 font-display text-[2.1rem] font-semibold leading-tight">{greeting(now, timezone)}{name ? `, ${name}` : ''}</h1>
        <p className="mt-2 max-w-xs text-[0.95rem] leading-relaxed text-muted">I’m here whenever you want to talk, plan, laugh or think something through.</p>
        <Link to="/settings" className="mt-4">
          {status.loading ? <Skeleton className="h-6 w-28" /> : status.data?.available
            ? <Badge tone="ok"><span className="size-1.5 rounded-full bg-ok" />Alina is online</Badge>
            : <Badge tone="danger"><span className="size-1.5 rounded-full bg-danger" />AI model offline</Badge>}
        </Link>
        <div className="mt-6 flex w-full max-w-sm gap-3">
          <Button size="lg" className="flex-1" icon={MessageCircle} onClick={() => nav('/chat/new')}>Start chatting</Button>
          <Button size="lg" variant="soft" className="aspect-square !px-0" aria-label="Talk with voice" onClick={() => nav('/voice')}><Mic className="size-6 text-accent" /></Button>
        </div>
      </section>

      <section className="mt-8" aria-label="Quick actions">
        <div className="stagger grid grid-cols-2 gap-3">
          {QUICK.map(({ to, label, hint, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-3xl border border-line bg-surface/80 p-4 transition active:scale-[.98] hover:border-accent/40">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-accent-ink"><Icon className="size-5" /></span>
              <p className="mt-3 font-medium">{label}</p>
              <p className="text-xs text-muted">{hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Today</h2>
          <Link to="/routine" className="inline-flex items-center text-sm text-accent">Daily routine<ChevronRight className="size-4" /></Link>
        </div>
        <Card className="p-2">
          {rem.loading || todo.loading ? <div className="space-y-2 p-2"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            : today.length === 0 ? (
              <div className="flex items-center gap-3 p-3 text-sm text-muted"><CalendarDays className="size-5 text-accent" />Nothing scheduled for today. Enjoy the calm, or add something.</div>
            ) : (
              <ul>
                {today.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-2xl p-3">
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', i.kind === 'reminder' ? 'bg-accent2/15 text-accent2' : 'bg-accent/12 text-accent')}>
                      {i.kind === 'reminder' ? <AlarmClock className="size-4" /> : <ListChecks className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem]">{i.title}</span>
                      <span className={cx('text-xs', i.overdue ? 'text-danger' : 'text-muted')}>{i.overdue ? 'Overdue · ' : ''}{formatDateTime(i.at, timezone, { weekday: undefined, day: undefined, month: undefined })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent chats</h2>
          <Link to="/chat" className="inline-flex items-center text-sm text-accent">See all<ChevronRight className="size-4" /></Link>
        </div>
        {recent.loading ? <Skeleton className="h-20" /> : recent.data?.items?.length ? (
          <ul className="space-y-2">
            {recent.data.items.map((c) => (
              <li key={c.id}>
                <Link to={`/chat/${c.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-surface/80 p-3.5 transition active:scale-[.99] hover:border-accent/40">
                  <Avatar size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2"><span className="truncate font-medium">{c.title}</span><span className="shrink-0 text-xs text-muted">{relativeTime(c.updated_at)}</span></span>
                    <span className="block truncate text-sm text-muted">{c.last_message_preview || 'No messages yet'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Card className="text-center text-sm text-muted">No conversations yet. Say hello above 👆</Card>}
      </section>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-muted"><Settings className="size-3.5" />Private by design — memory only with your consent.</p>
    </main>
  )
}
