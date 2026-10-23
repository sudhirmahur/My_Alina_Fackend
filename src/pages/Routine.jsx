import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import NotificationCard from '../components/NotificationCard'
import { AlarmClock, Check, Clock, ListChecks, Pencil, Plus, RefreshCw, Sunrise, Trash2 } from '../components/icons'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, Field, Input, PageBody, PageHeader, Segmented, Select, Sheet, Skeleton, Textarea } from '../components/ui'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import { cx } from '../lib/cx'
import { friendly } from '../lib/errors'
import { formatDateTime, isToday, timezones, toNaiveLocal, todayIn } from '../lib/format'
import { reminders as remApi, tasks as taskApi } from '../services'

const PRIORITY = { low: ['Low', 'neutral'], medium: ['Medium', 'warn'], high: ['High', 'danger'] }
const DELIVERY = {
  delivered: ['Push sent', 'ok'], retrying: ['Retrying delivery', 'warn'], failed: ['Delivery failed', 'danger'],
  no_devices: ['No device registered for push', 'warn'], provider_not_configured: ['Push not set up on server', 'warn'],
  deferred_quiet_hours: ['Held for quiet hours', 'neutral'],
}
const REPEAT = { none: 'Does not repeat', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
const WAKE = 'Wake-up'

const addDay = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
const fmt = (iso, tz) => formatDateTime(iso, tz)

/* ------------------------------------------------------------------ task sheet */
function TaskSheet({ open, onClose, item, tz, onDone }) {
  const toast = useToast()
  const editing = !!item
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(false)

  const init = () => setF({
    title: item?.title || '', description: item?.description || '', priority: item?.priority || 'medium', status: item?.status || 'todo',
    due: item?.due_at ? toNaiveLocal(item.due_at, item.timezone || tz) : '',
  })
  useEffect(() => { if (open) { init(); setError(null) } }, [open, item]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const body = { title: f.title.trim(), description: f.description.trim() || null, priority: f.priority, timezone: item?.timezone || tz, ...(f.due ? { due_at: f.due } : editing ? { due_at: null } : {}) }
      if (editing) await taskApi.update(item.id, { ...body, status: f.status })
      else await taskApi.create(body)
      toast.success(editing ? 'Task updated' : 'Task added')
      onDone(); onClose()
    } catch (e) { setError(friendly(e)) } finally { setBusy(false) }
  }
  const remove = async () => { try { await taskApi.remove(item.id); toast.success('Task deleted'); onDone(); onClose() } catch (e) { toast.error(friendly(e)); throw e } }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={editing ? 'Edit task' : 'New task'}
        footer={<div className="flex gap-3">
          {editing && <Button variant="danger" aria-label="Delete task" icon={Trash2} onClick={() => setConfirm(true)} />}
          <Button className="flex-1" size="lg" loading={busy} disabled={!f.title?.trim()} onClick={save}>{editing ? 'Save' : 'Add task'}</Button></div>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={f.title || ''} onChange={set('title')} maxLength={200} placeholder="What needs doing?" autoFocus={!editing} /></Field>
          <Field label="Notes (optional)"><Textarea value={f.description || ''} onChange={set('description')} rows={3} maxLength={2000} /></Field>
          <Field label="Due (optional)" hint={`Time zone: ${item?.timezone || tz}`}><Input type="datetime-local" value={f.due || ''} onChange={set('due')} /></Field>
          <Field label="Priority"><Segmented value={f.priority || 'medium'} onChange={(v) => setF((s) => ({ ...s, priority: v }))} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} /></Field>
          {editing && <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></Select></Field>}
          <ErrorNote error={error} />
        </div>
      </Sheet>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} danger confirmLabel="Delete" title="Delete this task?" text="This can’t be undone." />
    </>
  )
}

/* ------------------------------------------------------------------ reminder sheet */
function ReminderSheet({ open, onClose, item, tz, onDone }) {
  const toast = useToast()
  const editing = !!item
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    const z = item?.timezone || tz
    setF({
      title: item?.title || '', description: item?.description || '', timezone: z, error: null,
      when: item ? toNaiveLocal(item.scheduled_at, z) : toNaiveLocal(new Date(Date.now() + 3600000), z),
      freq: item?.recurrence?.frequency || 'none', interval: item?.recurrence?.interval || 1,
    })
    setError(null)
  }, [open, item]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const zones = useMemo(() => Array.from(new Set([f.timezone, tz, ...timezones()].filter(Boolean))), [f.timezone, tz])

  const save = async () => {
    setBusy(true); setError(null)
    try {
      const body = {
        title: f.title.trim(), description: f.description?.trim() || null, scheduled_at: f.when, timezone: f.timezone,
        recurrence: { frequency: f.freq, interval: f.freq === 'none' ? 1 : Math.max(1, Number(f.interval) || 1) },
      }
      if (editing) await remApi.update(item.id, body)
      else await remApi.create(body)
      toast.success(editing ? 'Reminder updated' : 'Reminder set')
      onDone(); onClose()
    } catch (e) { setError(friendly(e)) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit reminder' : 'New reminder'}
      footer={<Button className="w-full" size="lg" icon={AlarmClock} loading={busy} disabled={!f.title?.trim() || !f.when} onClick={save}>{editing ? 'Save' : 'Set reminder'}</Button>}>
      <div className="space-y-4">
        <Field label="Remind me to"><Input value={f.title || ''} onChange={set('title')} maxLength={200} placeholder="e.g. Call mom" autoFocus={!editing} /></Field>
        <Field label="Notes (optional)"><Textarea value={f.description || ''} onChange={set('description')} rows={2} maxLength={2000} /></Field>
        <Field label="When"><Input type="datetime-local" value={f.when || ''} onChange={set('when')} /></Field>
        <Field label="Time zone"><Select value={f.timezone || tz} onChange={set('timezone')}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <Field label="Repeat"><Select value={f.freq || 'none'} onChange={set('freq')}>{Object.entries(REPEAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          {f.freq && f.freq !== 'none' && <Field label="Every"><Input type="number" min={1} max={365} inputMode="numeric" value={f.interval} onChange={set('interval')} /></Field>}
        </div>
        <ErrorNote error={error} />
      </div>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ reminder actions */
function ReminderActions({ item, onClose, onEdit, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(false)
  if (!item) return null
  const run = async (key, fn, okMsg) => {
    setBusy(key)
    try { await fn(); toast.success(okMsg); onDone(); onClose() } catch (e) { toast.error(friendly(e)) } finally { setBusy('') }
  }
  const active = item.status === 'scheduled' || item.status === 'processing'
  return (
    <>
      <Sheet open onClose={onClose} title={item.title}>
        <p className="mb-4 text-sm text-muted">{fmt(item.next_fire_at || item.scheduled_at, item.timezone)} · {item.timezone}</p>
        {item.status === 'scheduled' && (
          <>
            <p className="mb-2 text-sm font-medium">Snooze</p>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {[[5, '5 min'], [10, '10 min'], [30, '30 min'], [60, '1 hour']].map(([m, label]) => (
                <Button key={m} variant="soft" size="sm" loading={busy === `s${m}`} onClick={() => run(`s${m}`, () => remApi.snooze(item.id, m), `Snoozed for ${label}`)}>{label}</Button>
              ))}
            </div>
          </>
        )}
        <div className="space-y-2">
          <Button variant="soft" className="w-full justify-start" icon={Pencil} onClick={() => { onClose(); onEdit(item) }}>Edit</Button>
          {active
            ? <Button variant="soft" className="w-full justify-start" icon={Check} loading={busy === 'cancel'} onClick={() => run('cancel', () => remApi.update(item.id, { status: 'cancelled' }), 'Reminder cancelled')}>Cancel this reminder</Button>
            : item.status === 'cancelled' && <Button variant="soft" className="w-full justify-start" icon={RefreshCw} loading={busy === 'on'} onClick={() => run('on', () => remApi.update(item.id, { status: 'scheduled' }), 'Reminder reactivated')}>Reactivate</Button>}
          <Button variant="danger" className="w-full justify-start" icon={Trash2} onClick={() => setConfirm(true)}>Delete</Button>
        </div>
      </Sheet>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger confirmLabel="Delete" title="Delete this reminder?" text="This can’t be undone."
        onConfirm={() => remApi.remove(item.id).then(() => { toast.success('Reminder deleted'); onDone(); onClose() }).catch((e) => { toast.error(friendly(e)); throw e })} />
    </>
  )
}

/* ------------------------------------------------------------------ rows */
function TaskRow({ t, tz, onToggle, onOpen }) {
  const done = t.status === 'done'
  const overdue = !done && t.due_at && new Date(t.due_at) < new Date()
  const [label, tone] = PRIORITY[t.priority] || PRIORITY.medium
  return (
    <li className="flex items-center gap-1 rounded-2xl">
      <button onClick={() => onToggle(t)} aria-label={done ? 'Mark as not done' : 'Mark as done'} aria-pressed={done}
        className="grid size-12 shrink-0 place-items-center">
        <span className={cx('grid size-6 place-items-center rounded-full border-2 transition', done ? 'border-ok bg-ok text-bg' : 'border-muted/60')}>{done && <Check className="size-4" />}</span>
      </button>
      <button onClick={() => onOpen(t)} className="min-w-0 flex-1 rounded-2xl py-2.5 pr-2 text-left">
        <span className={cx('block truncate text-[0.95rem]', done && 'text-muted line-through')}>{t.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {t.due_at && <span className={cx('inline-flex items-center gap-1 text-xs', overdue ? 'text-danger' : 'text-muted')}><Clock className="size-3" />{overdue ? 'Overdue · ' : ''}{fmt(t.due_at, t.timezone || tz)}</span>}
          {t.status === 'in_progress' && <Badge tone="accent">In progress</Badge>}
          {t.priority !== 'medium' && !done && <Badge tone={tone}>{label}</Badge>}
        </span>
      </button>
    </li>
  )
}

function ReminderRow({ r, onOpen }) {
  const [dLabel, dTone] = DELIVERY[r.delivery_status] || []
  const showDelivery = dLabel && r.status !== 'scheduled' && r.status !== 'cancelled'
  return (
    <li>
      <button onClick={() => onOpen(r)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-raised/50">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', r.status === 'scheduled' ? 'bg-accent2/15 text-accent2' : 'bg-raised text-muted')}><AlarmClock className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-[0.95rem]', r.status === 'cancelled' && 'text-muted line-through')}>{r.title}</span>
          <span className="block text-xs text-muted">{fmt(r.next_fire_at || r.scheduled_at, r.timezone)}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {r.recurrence?.frequency !== 'none' && <Badge tone="accent">{REPEAT[r.recurrence.frequency]}{r.recurrence.interval > 1 ? ` ×${r.recurrence.interval}` : ''}</Badge>}
            {r.status === 'cancelled' && <Badge>Cancelled</Badge>}
            {r.status === 'completed' && <Badge tone="ok">Done</Badge>}
            {r.snoozed_until && r.status === 'scheduled' && <Badge tone="warn">Snoozed</Badge>}
            {showDelivery && <Badge tone={dTone}>{dLabel}</Badge>}
          </span>
        </span>
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ wake-up */
function WakeUp({ list, tz, onDone }) {
  const toast = useToast()
  const existing = list.find((r) => r.title.startsWith(WAKE) && r.status === 'scheduled' && r.recurrence?.frequency === 'daily')
  const [time, setTime] = useState('07:00')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      let day = todayIn(tz)
      if (`${day}T${time}` <= toNaiveLocal(new Date(), tz)) day = addDay(day)
      await remApi.create({ title: `${WAKE}: Good morning ☀️`, scheduled_at: `${day}T${time}`, timezone: tz, recurrence: { frequency: 'daily', interval: 1 } })
      toast.success(`Wake-up set for ${time} every day`); onDone()
    } catch (e) { toast.error(friendly(e)) } finally { setBusy(false) }
  }
  const remove = async () => { try { await remApi.remove(existing.id); toast.success('Wake-up removed'); onDone() } catch (e) { toast.error(friendly(e)) } }

  return (
    <Card className="flex gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent2/15 text-accent2"><Sunrise className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Morning wake-up</p>
        {existing ? (
          <>
            <p className="mt-1 text-sm text-muted">Every day at {toNaiveLocal(existing.next_fire_at || existing.scheduled_at, existing.timezone).slice(11)} ({existing.timezone}).</p>
            <Button size="sm" variant="soft" className="mt-3" icon={Trash2} onClick={remove}>Remove</Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">A daily reminder to start your day gently.</p>
            <div className="mt-3 flex items-center gap-2">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-h-11 max-w-[8.5rem]" aria-label="Wake-up time" />
              <Button size="sm" loading={busy} onClick={create}>Set daily</Button>
            </div>
          </>
        )}
        <p className="mt-2.5 text-xs leading-snug text-muted">It’s a notification, not a native alarm clock.</p>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ page */
export default function Routine() {
  const { timezone: tz } = useSettings()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'today'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const [taskFilter, setTaskFilter] = useState('open')
  const [taskSheet, setTaskSheet] = useState(null) // {item?}
  const [remSheet, setRemSheet] = useState(null)
  const [remMenu, setRemMenu] = useState(null)

  const tasks = useResource(() => taskApi.list({ sort_by: 'due_at', order: 'asc' }), [])
  const rems = useResource(() => remApi.list(), [])
  const refresh = () => { tasks.reload(true); rems.reload(true) }

  const T = tasks.data?.items || []
  const R = rems.data?.items || []
  const open = T.filter((t) => t.status !== 'done')
  const upcoming = [...R].filter((r) => r.status === 'scheduled' || r.status === 'processing')
    .sort((a, b) => new Date(a.next_fire_at || a.scheduled_at) - new Date(b.next_fire_at || b.scheduled_at))
  const past = R.filter((r) => r.status === 'completed' || r.status === 'cancelled')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
  const now = new Date()
  const todayTasks = open.filter((t) => t.due_at && (isToday(t.due_at, tz) || new Date(t.due_at) < now))
  const todayRems = upcoming.filter((r) => isToday(r.next_fire_at || r.scheduled_at, tz))
  const shownTasks = taskFilter === 'open' ? open : taskFilter === 'done' ? T.filter((t) => t.status === 'done') : T

  const toggle = async (t) => {
    const next = t.status === 'done' ? 'todo' : 'done'
    tasks.setData((d) => ({ ...d, items: d.items.map((x) => (x.id === t.id ? { ...x, status: next } : x)) }))
    try { await taskApi.update(t.id, { status: next }); tasks.reload(true) } catch (e) { toast.error(friendly(e)); tasks.reload(true) }
  }

  const loading = (tasks.loading || rems.loading) && !tasks.data && !rems.data
  const error = tasks.error || rems.error

  return (
    <>
      <PageHeader title="Daily routine" subtitle={new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now)}
        actions={tab !== 'today' && <Button size="sm" icon={Plus} onClick={() => (tab === 'tasks' ? setTaskSheet({}) : setRemSheet({}))}>Add</Button>} />
      <PageBody className="space-y-5">
        <Segmented value={tab} onChange={setTab} label="Routine sections"
          options={[{ value: 'today', label: 'Today' }, { value: 'tasks', label: 'Tasks', count: open.length || undefined }, { value: 'reminders', label: 'Reminders', count: upcoming.length || undefined }]} />
        <ErrorNote error={error} onRetry={refresh} />

        {loading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : (
          <>
            {tab === 'today' && (
              <div className="space-y-5">
                <NotificationCard compact />
                <WakeUp list={R} tz={tz} onDone={refresh} />
                <section>
                  <h2 className="mb-2 font-display text-lg font-semibold">Today’s agenda</h2>
                  {todayRems.length + todayTasks.length === 0 ? (
                    <EmptyState icon={ListChecks} title="A clear day" text="Nothing due today. Add a task or a reminder to shape your routine."
                      action={<div className="flex gap-2"><Button size="sm" icon={Plus} onClick={() => setTaskSheet({})}>Task</Button><Button size="sm" variant="soft" icon={AlarmClock} onClick={() => setRemSheet({})}>Reminder</Button></div>} />
                  ) : (
                    <Card className="p-2">
                      <ul className="divide-y divide-line/60">
                        {todayRems.map((r) => <ReminderRow key={r.id} r={r} onOpen={setRemMenu} />)}
                        {todayTasks.map((t) => <TaskRow key={t.id} t={t} tz={tz} onToggle={toggle} onOpen={(x) => setTaskSheet({ item: x })} />)}
                      </ul>
                    </Card>
                  )}
                </section>
              </div>
            )}

            {tab === 'tasks' && (
              <div className="space-y-4">
                <Segmented value={taskFilter} onChange={setTaskFilter} label="Task filter" options={[{ value: 'open', label: 'To do' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]} />
                {shownTasks.length === 0 ? (
                  <EmptyState icon={ListChecks} title={taskFilter === 'done' ? 'Nothing completed yet' : 'No tasks'} text="Small steps add up. Add your first task."
                    action={<Button icon={Plus} onClick={() => setTaskSheet({})}>Add task</Button>} />
                ) : <Card className="p-2"><ul className="stagger divide-y divide-line/60">{shownTasks.map((t) => <TaskRow key={t.id} t={t} tz={tz} onToggle={toggle} onOpen={(x) => setTaskSheet({ item: x })} />)}</ul></Card>}
              </div>
            )}

            {tab === 'reminders' && (
              <div className="space-y-5">
                <NotificationCard compact />
                {upcoming.length === 0 && past.length === 0 ? (
                  <EmptyState icon={AlarmClock} title="No reminders" text="Set one and Alina will nudge you at the right time."
                    action={<Button icon={Plus} onClick={() => setRemSheet({})}>Set a reminder</Button>} />
                ) : (
                  <>
                    {upcoming.length > 0 && <Card className="p-2"><ul className="stagger divide-y divide-line/60">{upcoming.map((r) => <ReminderRow key={r.id} r={r} onOpen={setRemMenu} />)}</ul></Card>}
                    {past.length > 0 && (
                      <section>
                        <h2 className="mb-2 px-1 text-sm font-medium text-muted">Earlier</h2>
                        <Card className="p-2"><ul className="divide-y divide-line/60">{past.slice(0, 20).map((r) => <ReminderRow key={r.id} r={r} onOpen={setRemMenu} />)}</ul></Card>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </PageBody>

      <TaskSheet open={!!taskSheet} item={taskSheet?.item} tz={tz} onClose={() => setTaskSheet(null)} onDone={refresh} />
      <ReminderSheet open={!!remSheet} item={remSheet?.item} tz={tz} onClose={() => setRemSheet(null)} onDone={refresh} />
      <ReminderActions item={remMenu} onClose={() => setRemMenu(null)} onEdit={(r) => setRemSheet({ item: r })} onDone={refresh} />
    </>
  )
}
