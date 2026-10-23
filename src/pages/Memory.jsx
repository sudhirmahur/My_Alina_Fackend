import { useEffect, useState } from 'react'
import MemorySheet, { CATEGORIES } from '../components/MemorySheet'
import { Brain, Lock, Pause, Pencil, Play, Plus, Search, ShieldCheck, Trash2 } from '../components/icons'
import { Badge, Button, Card, Chip, ConfirmDialog, EmptyState, ErrorNote, IconButton, Input, PageBody, PageHeader, Sheet, Skeleton, Switch } from '../components/ui'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import { cx } from '../lib/cx'
import { friendly } from '../lib/errors'
import { relativeTime } from '../lib/format'
import { memory as api } from '../services'

const label = (v) => CATEGORIES.find((c) => c.value === v)?.label || v

export default function Memory() {
  const toast = useToast()
  const { reload: reloadSettings } = useSettings()
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [cat, setCat] = useState('')
  const [sheet, setSheet] = useState(null) // { item? }
  const [consent, setConsent] = useState(false)
  const [clear, setClear] = useState(false)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t) }, [q])

  const status = useResource(() => api.status(), [])
  const list = useResource(() => api.list({ q: dq || undefined, category: cat || undefined }), [dq, cat])
  const refresh = () => { status.reload(true); list.reload(true); reloadSettings() }

  const s = status.data
  const items = list.data?.items || []

  const act = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast.success(ok); refresh() } catch (e) { toast.error(friendly(e)) } finally { setBusy(false) }
  }
  const toggle = async (m) => {
    list.setData((d) => ({ ...d, items: d.items.map((x) => (x.id === m.id ? { ...x, enabled: !m.enabled } : x)) }))
    try { await api.update(m.id, { enabled: !m.enabled }) } catch (e) { toast.error(friendly(e)); list.reload(true) }
  }

  const state = !s ? null : !s.consent_granted ? 'off' : s.paused ? 'paused' : 'on'

  return (
    <>
      <PageHeader title="Memory" subtitle="Only what you choose to save" actions={<Button size="sm" icon={Plus} onClick={() => setSheet({})}>Add</Button>} />
      <PageBody className="space-y-5">
        {status.loading && !s ? <Skeleton className="h-36" /> : (
          <Card className={cx('space-y-3', state === 'on' && 'border-ok/30')}>
            <div className="flex items-start gap-3.5">
              <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', state === 'on' ? 'bg-ok/15 text-ok' : state === 'paused' ? 'bg-warn/15 text-warn' : 'bg-raised text-muted')}>
                {state === 'on' ? <ShieldCheck className="size-5" /> : state === 'paused' ? <Pause className="size-5" /> : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{state === 'on' ? 'Memory is on' : state === 'paused' ? 'Memory is paused' : 'Memory is off'}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">
                  {state === 'off' && 'Alina remembers nothing between chats until you turn this on. Passwords, keys and card numbers are never stored.'}
                  {state === 'paused' && 'Nothing new is saved while paused. Existing memories are still used in your chats.'}
                  {state === 'on' && `${s.count} ${s.count === 1 ? 'memory' : 'memories'} saved. Alina uses them to be more helpful — you control every one.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {state === 'off' && <Button size="sm" icon={ShieldCheck} onClick={() => setConsent(true)}>Turn on memory</Button>}
              {state === 'paused' && <Button size="sm" icon={Play} loading={busy} onClick={() => act(() => api.resume(false), 'Memory resumed')}>Resume</Button>}
              {state === 'on' && <Button size="sm" variant="soft" icon={Pause} loading={busy} onClick={() => act(() => api.pause(), 'Memory paused')}>Pause</Button>}
              {s?.count > 0 && <Button size="sm" variant="danger" icon={Trash2} onClick={() => setClear(true)}>Clear all</Button>}
            </div>
          </Card>
        )}

        <div className="space-y-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories" className="pl-10" aria-label="Search memories" /></div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter by category">
            <Chip active={!cat} onClick={() => setCat('')}>All</Chip>
            {CATEGORIES.map((c) => <Chip key={c.value} active={cat === c.value} onClick={() => setCat(c.value)}>{c.label}</Chip>)}
          </div>
        </div>

        <ErrorNote error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          : items.length === 0 && !list.error ? (
            <EmptyState icon={Brain} title={dq || cat ? 'No matching memories' : 'Nothing saved yet'}
              text={dq || cat ? 'Try a different search or filter.' : 'Add something you want Alina to know, or tap the bookmark under any of her replies.'}
              action={!dq && !cat && <Button icon={Plus} onClick={() => setSheet({})}>Add a memory</Button>} />
          ) : (
            <ul className="stagger space-y-2.5">
              {items.map((m) => (
                <li key={m.id} className={cx('rounded-3xl border border-line bg-surface/80 p-4 transition', !m.enabled && 'opacity-60')}>
                  <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]">{m.content}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{label(m.category)}</Badge>
                    {m.sensitive && <Badge tone="warn"><Lock className="size-3" />Sensitive</Badge>}
                    {!m.enabled && <Badge>Not used</Badge>}
                    <span className="text-xs text-muted">{relativeTime(m.updated_at)}</span>
                    <span className="ml-auto flex items-center">
                      <IconButton size="sm" icon={Pencil} label="Edit memory" onClick={() => setSheet({ item: m })} />
                      <IconButton size="sm" icon={Trash2} label="Delete memory" className="hover:text-danger" onClick={() => setTarget(m)} />
                    </span>
                  </div>
                  <div className="mt-1 border-t border-line/60 pt-1"><Switch checked={m.enabled} onChange={() => toggle(m)} label="Use in chats" /></div>
                </li>
              ))}
            </ul>
          )}
      </PageBody>

      <MemorySheet open={!!sheet} item={sheet?.item} onClose={() => setSheet(null)} onSaved={refresh} />

      <Sheet open={consent} onClose={() => setConsent(false)} title="Turn on memory?"
        footer={<div className="flex gap-3"><Button variant="soft" className="flex-1" onClick={() => setConsent(false)}>Not now</Button>
          <Button className="flex-1" loading={busy} onClick={() => act(() => api.resume(true), 'Memory is on').then(() => setConsent(false))}>Turn on</Button></div>}>
        <ul className="space-y-3 text-sm leading-relaxed">
          <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />Alina only saves what you explicitly add or approve.</li>
          <li className="flex gap-3"><Lock className="mt-0.5 size-5 shrink-0 text-ok" />Passwords, keys and card numbers are never stored. Sensitive topics need extra consent each time.</li>
          <li className="flex gap-3"><Trash2 className="mt-0.5 size-5 shrink-0 text-ok" />You can edit, switch off, pause or permanently delete any memory — or all of them.</li>
        </ul>
      </Sheet>

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} danger confirmLabel="Delete" title="Delete this memory?" text="It is permanently deleted and Alina will no longer know it."
        onConfirm={() => api.remove(target.id).then(() => { toast.success('Memory deleted'); refresh() }).catch((e) => { toast.error(friendly(e)); throw e })} />
      <ConfirmDialog open={clear} onClose={() => setClear(false)} danger confirmLabel="Delete everything" requireText="DELETE" title="Delete all memories?"
        text={`All ${s?.count ?? ''} memories are permanently deleted. This can’t be undone.`}
        onConfirm={() => api.clearAll().then((r) => { toast.success(`${r.deleted_count} memories deleted`); refresh() }).catch((e) => { toast.error(friendly(e)); throw e })} />
    </>
  )
}
