import { useEffect, useState } from 'react'
import { Brain, Lock } from './icons'
import { Button, ErrorNote, Field, Select, Sheet, Switch, Textarea } from './ui'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { friendly } from '../lib/errors'
import { memory } from '../services'

export const CATEGORIES = [
  { value: 'preference', label: 'Preference' },
  { value: 'personal_fact', label: 'About me' },
  { value: 'goal', label: 'Goal' },
  { value: 'relationship', label: 'People' },
  { value: 'other', label: 'Other' },
]

/**
 * Add or edit one memory. Nothing is saved until the user presses Save, and if memory is off the
 * sheet explains it and asks for explicit consent first.
 */
export default function MemorySheet({ open, onClose, item, initialText = '', onSaved }) {
  const { reload } = useSettings()
  const toast = useToast()
  const editing = !!item
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('preference')
  const [sensitive, setSensitive] = useState(false)
  const [sensitiveOk, setSensitiveOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [blocker, setBlocker] = useState(null) // 'consent' | 'paused' | null

  useEffect(() => {
    if (!open) return
    setContent(item?.content ?? initialText.slice(0, 500))
    setCategory(item?.category ?? 'preference')
    setSensitive(item?.sensitive ?? false)
    setSensitiveOk(false); setError(null); setBlocker(null); setBusy(false)
  }, [open, item, initialText])

  const save = async ({ enableFirst } = {}) => {
    setBusy(true); setError(null)
    try {
      if (enableFirst === 'consent') await memory.resume(true)
      if (enableFirst === 'paused') await memory.resume(false)
      if (enableFirst) { setBlocker(null); reload() }
      const body = { content: content.trim(), category, sensitive, ...(sensitive ? { sensitive_consent: sensitiveOk } : {}) }
      const saved = editing ? await memory.update(item.id, body) : await memory.create(body)
      toast.success(editing ? 'Memory updated' : 'Saved to memory')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      if (err.code === 'memory_consent_required') setBlocker('consent')
      else if (err.code === 'memory_paused') setBlocker('paused')
      else setError(friendly(err))
    } finally { setBusy(false) }
  }

  const tooLong = content.length > 500
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit memory' : 'Save to memory'}
      footer={<Button className="w-full" size="lg" icon={Brain} loading={busy} disabled={!content.trim() || tooLong || (sensitive && !sensitiveOk)} onClick={() => save()}>
        {editing ? 'Save changes' : 'Save memory'}</Button>}>
      <div className="space-y-4">
        {blocker === 'consent' && (
          <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed">
            <p className="flex items-center gap-2 font-medium"><Lock className="size-4 text-accent" />Memory is off</p>
            <p className="text-muted">Alina only remembers things you choose to save. You can see, edit, pause or delete every memory at any time, and secrets such as passwords are never stored.</p>
            <Button size="sm" loading={busy} onClick={() => save({ enableFirst: 'consent' })}>Turn on memory &amp; save</Button>
          </div>
        )}
        {blocker === 'paused' && (
          <div className="space-y-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm">
            <p>Memory is paused. Resume it to save this.</p>
            <Button size="sm" loading={busy} onClick={() => save({ enableFirst: 'paused' })}>Resume memory &amp; save</Button>
          </div>
        )}
        <Field label="What should Alina remember?" hint={`${content.length}/500`} error={tooLong ? 'Please keep it under 500 characters.' : undefined}>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="e.g. I prefer short, friendly answers in Hinglish." autoFocus />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <div>
          <Switch checked={sensitive} onChange={setSensitive} label="This is sensitive" description="Health, finances or other private details. Needs extra consent." />
          {sensitive && (
            <label className="mt-1 flex items-start gap-3 rounded-2xl bg-raised/70 p-3 text-sm">
              <input type="checkbox" checked={sensitiveOk} onChange={(e) => setSensitiveOk(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span>I understand this will be stored and may be used in my chats. I can delete it any time.</span>
            </label>
          )}
        </div>
        <ErrorNote error={error} />
      </div>
    </Sheet>
  )
}
