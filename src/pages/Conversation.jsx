import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MemorySheet from '../components/MemorySheet'
import MessageBubble from '../components/MessageBubble'
import { ArrowLeft, ChevronDown, Laugh, Lightbulb, MoreHorizontal, Mic, Pencil, Send, Sparkles, Square, Trash2, Coffee } from '../components/icons'
import { Avatar, Button, ConfirmDialog, ErrorNote, Field, IconButton, Input, Sheet, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import useSpeaker from '../hooks/useSpeaker'
import useViewportHeight from '../hooks/useViewportHeight'
import { cx } from '../lib/cx'
import { chatsChanged } from '../lib/events'
import { friendly } from '../lib/errors'
import { newId } from '../lib/format'
import { ApiError } from '../lib/api'
import { ai, chats } from '../services'

const MAX_CHARS = 4000
const STARTERS = [
  { icon: Laugh, text: 'Tell me a joke' },
  { icon: Coffee, text: 'Help me plan my day' },
  { icon: Lightbulb, text: 'I have an idea to talk through' },
  { icon: Sparkles, text: 'Teach me something interesting' },
]

function Composer({ busy, disabled, onSend, onStop, initial }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const nav = useNavigate()

  useEffect(() => { if (initial) setText(initial) }, [initial])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [text])

  const submit = () => {
    const t = text.trim()
    if (!t || busy || disabled) return
    onSend(t)
    setText('')
  }
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    if (matchMedia('(pointer: coarse)').matches) return // phones: Enter adds a new line, the button sends
    e.preventDefault(); submit()
  }
  const near = text.length > MAX_CHARS * 0.85
  return (
    <div className="pb-safe shrink-0 border-t border-line/60 bg-bg/85 px-3 pt-2.5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-end gap-2 pb-2.5">
        <div className="relative flex-1">
          <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} rows={1}
            maxLength={MAX_CHARS} placeholder="Message Alina…" aria-label="Message Alina" enterKeyHint="send"
            className="block max-h-40 min-h-12 w-full resize-none rounded-3xl border border-line bg-raised/80 py-3 pl-4 pr-12 leading-relaxed placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15" />
          <IconButton icon={Mic} label="Talk to Alina (voice)" size="sm" className="absolute bottom-1.5 right-1.5" onClick={() => nav('/voice')} />
        </div>
        {busy ? (
          <button onClick={onStop} aria-label="Stop generating" className="grid size-12 shrink-0 place-items-center rounded-full bg-raised text-accent ring-1 ring-accent/40 transition active:scale-90">
            <Square className="size-5 fill-current" />
          </button>
        ) : (
          <button onClick={submit} disabled={!text.trim() || disabled} aria-label="Send message"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--accent)] transition active:scale-90 disabled:opacity-40 disabled:shadow-none">
            <Send className="size-5" />
          </button>
        )}
      </div>
      {near && <p className="-mt-1 pb-2 text-center text-xs text-muted">{text.length}/{MAX_CHARS}</p>}
    </div>
  )
}

export default function Conversation() {
  const { chatId: param } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { timezone } = useSettings()
  const speaker = useSpeaker()
  useViewportHeight()

  const aiStatus = useResource(() => ai.status(), [])
  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(param !== 'new')
  const [loadError, setLoadError] = useState(null)
  const [earlier, setEarlier] = useState({ has: false, page: 1, busy: false })
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'clear' | 'delete'
  const [remember, setRemember] = useState(null)
  const [showJump, setShowJump] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const chatIdRef = useRef(param === 'new' ? null : param)
  const loadedFor = useRef(param === 'new' ? 'new' : null)
  const abortRef = useRef(null)
  const busyRef = useRef(false)
  const scrollRef = useRef(null)
  const stick = useRef(true)
  const anchor = useRef(null)
  const tokenBuf = useRef({ id: null, text: '' })
  const raf = useRef(0)

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    if (param === loadedFor.current) return undefined // created during this session: state is already current
    abortRef.current?.abort()
    speaker.stop()
    let alive = true
    chatIdRef.current = param === 'new' ? null : param
    setLoadError(null)
    if (param === 'new') {
      loadedFor.current = 'new'
      setChat(null); setMessages([]); setLoading(false); setEarlier({ has: false, page: 1, busy: false })
      return undefined
    }
    setLoading(true); setMessages([]); setChat(null)
    Promise.all([chats.get(param), chats.messages(param, { page: 1 })])
      .then(([c, page]) => {
        if (!alive) return
        loadedFor.current = param
        stick.current = true
        setChat(c); setMessages([...page.items].reverse())
        setEarlier({ has: page.has_more, page: 1, busy: false })
      })
      .catch((e) => alive && setLoadError(e))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [param, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { abortRef.current?.abort(); cancelAnimationFrame(raf.current) }, [])

  const loadEarlier = async () => {
    if (earlier.busy || !chatIdRef.current) return
    setEarlier((e) => ({ ...e, busy: true }))
    try {
      const page = await chats.messages(chatIdRef.current, { page: earlier.page + 1 })
      const el = scrollRef.current
      anchor.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null
      setMessages((m) => [...[...page.items].reverse(), ...m])
      setEarlier({ has: page.has_more, page: earlier.page + 1, busy: false })
    } catch (e) { toast.error(friendly(e)); setEarlier((s) => ({ ...s, busy: false })) }
  }

  // ---------------------------------------------------------------- scrolling
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (anchor.current) { el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top; anchor.current = null; return }
    if (stick.current) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const onScroll = () => {
    const el = scrollRef.current
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    stick.current = gap < 140
    setShowJump(gap > 400)
  }
  const jump = () => { stick.current = true; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }

  // ---------------------------------------------------------------- sending
  const patchMessage = useCallback((id, fn) => setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m))), [])

  const flushTokens = useCallback(() => {
    raf.current = 0
    const { id, text } = tokenBuf.current
    if (!id || !text) return
    tokenBuf.current = { id, text: '' }
    patchMessage(id, (m) => ({ ...m, content: m.content + text }))
  }, [patchMessage])

  const queueToken = (id, text) => {
    tokenBuf.current = { id, text: (tokenBuf.current.id === id ? tokenBuf.current.text : '') + text }
    if (!raf.current) raf.current = requestAnimationFrame(flushTokens)
  }

  const send = useCallback(async (text, cid) => {
    if (busyRef.current) return
    const id = cid || newId()
    const aid = `a-${id}`
    const now = new Date().toISOString()
    busyRef.current = true; setBusy(true); stick.current = true
    speaker.stop()
    setMessages((m) => [...m,
      { id: `u-${id}`, role: 'user', content: text, status: 'sent', created_at: now, cid: id },
      { id: aid, role: 'assistant', content: '', status: 'pending', created_at: now, cid: id, streaming: true }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    tokenBuf.current = { id: aid, text: '' }
    const fail = (e) => { flushTokens(); patchMessage(aid, (m) => ({ ...m, streaming: false, status: 'failed', errorText: friendly(e) })) }

    try {
      await chats.stream({ chat_id: chatIdRef.current || undefined, message: text, client_message_id: id }, {
        signal: ctrl.signal,
        onMeta: (meta) => {
          if (!chatIdRef.current) { chatIdRef.current = meta.chat_id; loadedFor.current = meta.chat_id; nav(`/chat/${meta.chat_id}`, { replace: true }) }
        },
        onToken: (t) => queueToken(aid, t),
        onDone: ({ message }) => { flushTokens(); patchMessage(aid, (m) => ({ ...m, ...message, id: aid, cid: id, streaming: false })) },
        onError: (e) => fail(new ApiError(0, e.code, e.message)),
      })
    } catch (err) {
      if (ctrl.signal.aborted) {
        flushTokens()
        patchMessage(aid, (m) => ({ ...m, streaming: false, status: 'interrupted' }))
      } else fail(err)
    } finally {
      busyRef.current = false; setBusy(false); abortRef.current = null
      if (chatIdRef.current) {
        chats.get(chatIdRef.current).then(setChat).catch(() => {})
        chatsChanged()
      }
    }
  }, [flushTokens, nav, patchMessage, speaker])

  const stop = () => abortRef.current?.abort()

  const retry = (idx) => {
    const failed = messages[idx]
    const user = messages[idx - 1]
    if (!user || user.role !== 'user') return
    setMessages((m) => m.filter((x) => x.id !== failed.id && x.id !== user.id))
    send(user.content, user.cid)
  }

  const speak = (msg) => (speaker.speakingId === msg.id ? speaker.stop() : speaker.speak(msg.content, msg.id).then((ok) => { if (!ok) toast.error('Speech is not available on this device.') }))

  // ---------------------------------------------------------------- header actions
  const rename = async () => {
    try { const c = await chats.rename(chatIdRef.current, renaming.trim()); setChat(c); chatsChanged(); setRenaming(null); toast.success('Renamed') }
    catch (e) { toast.error(friendly(e)) }
  }
  const clearAll = async () => {
    try { await chats.clear(chatIdRef.current); setMessages([]); setEarlier({ has: false, page: 1, busy: false }); chatsChanged(); toast.success('Messages cleared') }
    catch (e) { toast.error(friendly(e)); throw e }
  }
  const deleteChat = async () => {
    try { await chats.remove(chatIdRef.current); chatsChanged(); toast.success('Conversation deleted'); nav('/chat', { replace: true }) }
    catch (e) { toast.error(friendly(e)); throw e }
  }

  const online = aiStatus.data?.available
  const empty = !loading && !loadError && messages.length === 0
  const name = user?.display_name?.split(' ')[0]

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <header className="pt-safe z-10 shrink-0 border-b border-line/60 bg-bg/85 backdrop-blur-xl">
        <div className="flex min-h-16 items-center gap-2 px-3">
          <IconButton icon={ArrowLeft} label="Back to chats" className="lg:hidden" onClick={() => nav('/chat')} />
          <Avatar size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.02rem] font-semibold leading-tight">{chat?.title || 'New chat'}</h1>

<p className="flex items-center gap-1.5 text-xs text-muted">
  <span
    className={cx(
      'size-1.5 rounded-full',
      aiStatus.loading
        ? 'bg-muted'
        : online
          ? 'bg-ok'
          : 'bg-danger'
    )}
  />

  {aiStatus.loading
    ? 'Checking…'
    : online
      ? 'Alina Online'
      : 'Alina Offline'}
</p>

          </div>
          {chatIdRef.current && <IconButton icon={MoreHorizontal} label="Conversation options" onClick={() => setMenu(true)} />}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain" role="log" aria-live="polite" aria-label="Conversation">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 px-4 py-5">
          {loadError && <ErrorNote error={loadError} onRetry={() => { loadedFor.current = null; setReloadKey((k) => k + 1) }} />}
          {earlier.has && <Button variant="soft" size="sm" className="self-center" loading={earlier.busy} onClick={loadEarlier}>Load earlier messages</Button>}
          {loading && <div className="space-y-4"><Skeleton className="h-14 w-2/3" /><Skeleton className="ml-auto h-10 w-1/2" /><Skeleton className="h-20 w-3/4" /></div>}

          {empty && (
            <div className="rise m-auto flex w-full max-w-sm flex-col items-center py-8 text-center">
              <div className="float"><Avatar size={120} glow /></div>
              <h2 className="mt-6 font-display text-2xl font-semibold">{name ? `Hi ${name}, ` : 'Hi, '}what’s on your mind?</h2>
              <p className="mt-1.5 text-sm text-muted">Talk about anything — your day, an idea, a worry, a joke.</p>
              {aiStatus.data && !online && <ErrorNote className="mt-5 text-left" error={aiStatus.data.detail || friendly({ code: 'ai_unavailable' })} onRetry={aiStatus.reload} />}
              <div className="stagger mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {STARTERS.map(({ icon: Icon, text }) => (
                  <button key={text} onClick={() => send(text)} disabled={busy}
                    className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface/80 px-3.5 text-left text-sm transition hover:border-accent/50 active:scale-[.98]">
                    <Icon className="size-4 shrink-0 text-accent" />{text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={m.id} msg={m} tz={timezone} isLast={i === messages.length - 1}
              speaking={speaker.speakingId === m.id}
              onRetry={m.role === 'assistant' && (m.status === 'failed' || (i === messages.length - 1 && m.status === 'interrupted')) && !busy ? () => retry(i) : undefined}
              onSpeak={speak} onRemember={(msg) => setRemember(msg.content)} />
          ))}
        </div>
        {showJump && (
          <button onClick={jump} aria-label="Jump to latest message"
            className="pop-in sticky bottom-3 left-1/2 mx-auto grid size-10 -translate-x-1/2 place-items-center rounded-full border border-line bg-raised shadow-lg">
            <ChevronDown className="size-5" />
          </button>
        )}
      </div>

      <Composer busy={busy} disabled={!!loadError || loading} onSend={(t) => send(t)} onStop={stop} />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Conversation">
        <div className="space-y-2">
          <Button variant="soft" className="w-full justify-start" icon={Pencil} onClick={() => { setMenu(false); setRenaming(chat?.title || '') }}>Rename</Button>
          <Button variant="soft" className="w-full justify-start" icon={Trash2} onClick={() => { setMenu(false); setConfirm('clear') }}>Clear messages</Button>
          <Button variant="danger" className="w-full justify-start" icon={Trash2} onClick={() => { setMenu(false); setConfirm('delete') }}>Delete conversation</Button>
        </div>
      </Sheet>

      <Sheet open={renaming !== null} onClose={() => setRenaming(null)} title="Rename conversation"
        footer={<Button className="w-full" size="lg" disabled={!renaming?.trim()} onClick={rename}>Save</Button>}>
        <Field label="Title"><Input value={renaming ?? ''} maxLength={120} onChange={(e) => setRenaming(e.target.value)} autoFocus /></Field>
      </Sheet>

      <ConfirmDialog open={confirm === 'clear'} onClose={() => setConfirm(null)} onConfirm={clearAll} danger confirmLabel="Clear"
        title="Clear all messages?" text="The conversation stays, but every message in it is permanently deleted." />
      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={deleteChat} danger confirmLabel="Delete"
        title="Delete this conversation?" text="The conversation and all its messages will be permanently deleted." />

      <MemorySheet open={remember !== null} onClose={() => setRemember(null)} initialText={remember || ''} />
    </div>
  )
}
