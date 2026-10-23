import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useMatch } from 'react-router-dom'
import { MessageCircle, Plus, Search, Trash2 } from '../components/icons'
import { Avatar, Button, ConfirmDialog, EmptyState, ErrorNote, IconButton, Input, Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { cx } from '../lib/cx'
import { friendly } from '../lib/errors'
import { onChatsChanged } from '../lib/events'
import { relativeTime } from '../lib/format'
import { chats } from '../services'

export function ChatList({ className }) {
  const nav = useNavigate()
  const toast = useToast()
  const active = useMatch('/chat/:chatId')?.params.chatId
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [target, setTarget] = useState(null)
  const seq = useRef(0)

  const load = useCallback(async (p = 1, query = q, append = false) => {
    const id = ++seq.current
    if (!append) setLoading(true)
    try {
      const res = await chats.list({ page: p, q: query.trim() || undefined, archived: false })
      if (id !== seq.current) return
      setItems((l) => (append ? [...l, ...res.items] : res.items))
      setPage(p); setMore(res.has_more); setError(null)
    } catch (e) { if (id === seq.current) setError(e) } finally { if (id === seq.current) setLoading(false) }
  }, [q])

  useEffect(() => { const t = setTimeout(() => load(1, q), q ? 300 : 0); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onChatsChanged(() => load(1, q)), [load, q])

  const remove = async () => {
    try {
      await chats.remove(target.id)
      setItems((l) => l.filter((c) => c.id !== target.id))
      toast.success('Conversation deleted')
      if (active === target.id) nav('/chat', { replace: true })
    } catch (e) { toast.error(friendly(e)); throw e }
  }

  return (
    <section className={cx('w-full min-w-0 flex-col lg:w-[22rem] lg:shrink-0 lg:border-r lg:border-line', className)}>
      <header className="pt-safe border-b border-line/60 bg-bg/80 px-4 pb-3 backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between">
          <h1 className="font-display text-[1.45rem] font-semibold">Chats</h1>
          <Button size="sm" icon={Plus} onClick={() => nav('/chat/new')}>New chat</Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="min-h-11 pl-10" aria-label="Search conversations" />
        </div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {error && <ErrorNote error={error} onRetry={() => load(1, q)} className="mb-3" />}
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[4.5rem]" />)}</div>
        ) : items.length === 0 && !error ? (
          q ? <EmptyState icon={Search} title="No matches" text="Try a different word." />
            : <EmptyState icon={MessageCircle} title="No conversations yet" text="Say hello — Alina is ready when you are."
                action={<Button icon={Plus} onClick={() => nav('/chat/new')}>Start chatting</Button>} />
        ) : (
          <ul className="stagger space-y-1.5">
            {items.map((c) => (
              <li key={c.id} className="group relative">
                <button onClick={() => nav(`/chat/${c.id}`)} aria-current={active === c.id ? 'page' : undefined}
                  className={cx('flex w-full items-center gap-3 rounded-2xl px-3 py-3 pr-12 text-left transition',
                    active === c.id ? 'bg-accent/12 ring-1 ring-accent/30' : 'hover:bg-raised/60')}>
                  <Avatar size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[0.95rem] font-medium">{c.title}</span>
                      <span className="shrink-0 text-[0.7rem] text-muted">{relativeTime(c.updated_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{c.last_message_preview || 'No messages yet'}</span>
                  </span>
                </button>
                <IconButton icon={Trash2} label={`Delete ${c.title}`} size="sm" onClick={() => setTarget(c)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:text-danger group-hover:opacity-100" />
              </li>
            ))}
          </ul>
        )}
        {more && !loading && <Button variant="soft" className="mt-3 w-full" onClick={() => load(page + 1, q, true)}>Load more</Button>}
      </div>

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={remove} danger confirmLabel="Delete"
        title="Delete this conversation?" text={`“${target?.title ?? ''}” and all its messages will be permanently deleted.`} />
    </section>
  )
}

export function ChatEmpty() {
  const nav = useNavigate()
  return (
    <div className="hidden flex-1 place-items-center lg:grid">
      <EmptyState icon={MessageCircle} title="Pick a conversation" text="Choose one on the left, or start a new chat with Alina."
        action={<Button icon={Plus} onClick={() => nav('/chat/new')}>New chat</Button>} />
    </div>
  )
}

export function ChatLayout() {
  const { pathname } = useLocation()
  const onList = pathname.replace(/\/$/, '') === '/chat'
  return (
    <div className={cx('flex w-full', onList ? 'h-[calc(100dvh-var(--nav-h))] lg:h-dvh' : 'h-vv lg:h-dvh')}>
      <ChatList className={cx(onList ? 'flex' : 'hidden', 'lg:flex')} />
      <div className={cx('min-w-0 flex-1 flex-col', onList ? 'hidden' : 'flex', 'lg:flex')}><Outlet /></div>
    </div>
  )
}
