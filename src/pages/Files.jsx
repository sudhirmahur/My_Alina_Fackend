import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, FileUp, Loader2, RefreshCw, Search, Send, Sparkles, Trash2 } from '../components/icons'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorNote, IconButton, Input, PageBody, PageHeader, Sheet, Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import { cx } from '../lib/cx'
import { friendly } from '../lib/errors'
import { formatBytes, relativeTime } from '../lib/format'
import { files as api } from '../services'

const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json,.py,.js,.ts,.java,.c,.cpp,.go,.rs,.sql,.html,.css,.yaml,.yml'
const QUICK = ['Summarize this document', 'List the key points', 'What are the action items or deadlines?']

const STATUS = {
  uploaded: ['Queued', 'neutral'], processing: ['Reading…', 'warn'], ready: ['Ready', 'ok'], failed: ['Failed', 'danger'],
}

function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] || ['Unknown', 'neutral']
  return <Badge tone={tone}>{(status === 'processing' || status === 'uploaded') && <Loader2 className="size-3 animate-spin" />}{label}</Badge>
}

function Sources({ sources }) {
  if (!sources?.length) return null
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
      {sources.map((s, i) => (
        <details key={i} className="group rounded-2xl bg-raised/70 px-3 py-2 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <FileText className="size-3.5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate">{s.filename}{s.page ? ` · page ${s.page}` : ''}{s.section ? ` · ${s.section}` : ''}</span>
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">{s.snippet}</p>
        </details>
      ))}
    </div>
  )
}

function FileSheet({ file, onClose, onChanged }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [thread, setThread] = useState([])
  const [confirm, setConfirm] = useState(false)
  const [re, setRe] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { setThread([]); setQ('') }, [file?.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [thread, busy])
  if (!file) return null

  const ask = async (text) => {
    const question = (text ?? q).trim()
    if (!question || busy) return
    setQ(''); setBusy(true)
    setThread((t) => [...t, { question }])
    try {
      const res = await api.ask(file.id, question)
      setThread((t) => [...t.slice(0, -1), { question, ...res }])
    } catch (e) { setThread((t) => [...t.slice(0, -1), { question, error: friendly(e) }]) } finally { setBusy(false) }
  }
  const reprocess = async () => {
    setRe(true)
    try { await api.reprocess(file.id); toast.info('Reading the file again…'); onChanged() } catch (e) { toast.error(friendly(e)) } finally { setRe(false) }
  }
  const remove = async () => {
    try { await api.remove(file.id); toast.success('File deleted'); onChanged(); onClose() } catch (e) { toast.error(friendly(e)); throw e }
  }

  const ready = file.status === 'ready'
  return (
    <>
      <Sheet open onClose={onClose} title={file.filename} size="lg"
        footer={ready && (
          <form onSubmit={(e) => { e.preventDefault(); ask() }} className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this file…" maxLength={1000} aria-label="Question" className="min-h-12 flex-1" />
            <button type="submit" disabled={!q.trim() || busy} aria-label="Ask" className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition active:scale-90 disabled:opacity-40"><Send className="size-5" /></button>
          </form>)}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusBadge status={file.status} />
          <span>{formatBytes(file.size)}</span>
          {file.page_count ? <span>· {file.page_count} pages</span> : null}
          {file.chunk_count ? <span>· {file.chunk_count} sections</span> : null}
          <span>· {relativeTime(file.created_at)}</span>
        </div>

        {(file.status === 'processing' || file.status === 'uploaded') && (
          <Card className="flex items-center gap-3 text-sm"><Loader2 className="size-5 animate-spin text-accent" />Alina is reading this file. This usually takes a few seconds.</Card>
        )}
        {file.status === 'failed' && (
          <div className="space-y-3">
            <ErrorNote error={file.error_message || 'This file could not be read.'} />
            <Button variant="soft" icon={RefreshCw} loading={re} onClick={reprocess}>Try reading again</Button>
          </div>
        )}
        {ready && thread.length === 0 && (
          <div className="py-2">
            <p className="mb-3 flex items-center gap-2 text-sm text-muted"><Sparkles className="size-4 text-accent" />Ask anything — answers come only from this file and name their source.</p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((s) => <button key={s} onClick={() => ask(s)} className="min-h-10 rounded-full border border-line bg-surface px-3.5 text-sm transition hover:border-accent/50 active:scale-95">{s}</button>)}
            </div>
          </div>
        )}
        <div className="space-y-5">
          {thread.map((t, i) => (
            <div key={i} className="space-y-2.5">
              <p className="ml-auto w-fit max-w-[88%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[0.95rem] text-accent-ink">{t.question}</p>
              {t.error ? <ErrorNote error={t.error} /> : t.answer === undefined ? (
                <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" />Searching the file…</p>
              ) : (
                <div className="rounded-3xl rounded-tl-lg border border-line bg-surface px-4 py-3 text-[0.95rem] leading-relaxed">
                  {t.answerable === false && <Badge tone="warn" className="mb-2"><AlertTriangle className="size-3" />Not found in this file</Badge>}
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{t.answer}</p>
                  <Sources sources={t.sources} />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <Button variant="danger" size="sm" className="mt-6" icon={Trash2} onClick={() => setConfirm(true)}>Delete file</Button>
      </Sheet>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} danger confirmLabel="Delete" title="Delete this file?"
        text="The original file and all text Alina extracted from it are permanently deleted." />
    </>
  )
}

export default function Files() {
  const toast = useToast()
  const list = useResource(() => api.list(), [])
  const [q, setQ] = useState('')
  const [uploading, setUploading] = useState([])
  const [openId, setOpenId] = useState(null)
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  const items = list.data?.items || []
  const pending = items.some((f) => f.status === 'processing' || f.status === 'uploaded')
  useEffect(() => {
    if (!pending) return undefined
    const t = setInterval(() => list.reload(true), 2500)
    return () => clearInterval(t)
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (fileList) => {
    for (const file of Array.from(fileList || [])) {
      const key = `${file.name}-${Date.now()}`
      setUploading((u) => [...u, { key, name: file.name }])
      try { await api.upload(file); toast.success(`Uploaded ${file.name}`); list.reload(true) }
      catch (e) { toast.error(`${file.name}: ${friendly(e)}`) }
      finally { setUploading((u) => u.filter((x) => x.key !== key)) }
    }
  }

  const shown = items.filter((f) => f.filename.toLowerCase().includes(q.trim().toLowerCase()))
  const open = items.find((f) => f.id === openId)

  return (
    <>
      <PageHeader title="Files" subtitle="Ask questions about your documents" actions={<Button size="sm" icon={FileUp} onClick={() => input.current?.click()}>Upload</Button>} />
      <PageBody className="space-y-4">
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        <button onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }}
          className={cx('flex w-full flex-col items-center gap-1 rounded-3xl border-2 border-dashed px-4 py-6 text-center transition',
            drag ? 'border-accent bg-accent/10' : 'border-line bg-surface/50 hover:border-accent/50')}>
          <FileUp className="size-6 text-accent" />
          <span className="font-medium">Tap to choose files</span>
          <span className="text-xs text-muted">PDF, DOCX, TXT, CSV, Markdown, JSON or code · kept private to you</span>
        </button>

        {uploading.map((u) => <Card key={u.key} className="flex items-center gap-3 text-sm"><Loader2 className="size-5 animate-spin text-accent" /><span className="truncate">Uploading {u.name}…</span></Card>)}

        {items.length > 4 && (
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" className="pl-10" aria-label="Search files" /></div>
        )}

        <ErrorNote error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? <div className="space-y-2"><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /></div>
          : shown.length === 0 && !list.error ? (
            <EmptyState icon={FileText} title={q ? 'No matching files' : 'No files yet'} text={q ? 'Try another name.' : 'Upload a document, then ask Alina about it.'} />
          ) : (
            <ul className="stagger space-y-2">
              {shown.map((f) => (
                <li key={f.id}>
                  <button onClick={() => setOpenId(f.id)} className="flex w-full items-center gap-3.5 rounded-3xl border border-line bg-surface/80 p-3.5 text-left transition active:scale-[.99] hover:border-accent/40">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-xs font-semibold uppercase text-accent">{f.extension.replace('.', '').slice(0, 4) || <FileText className="size-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.filename}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><span>{formatBytes(f.size)}</span><span>{relativeTime(f.created_at)}</span></span>
                    </span>
                    {f.status === 'ready' ? <CheckCircle2 className="size-5 shrink-0 text-ok" aria-label="Ready" /> : <StatusBadge status={f.status} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </PageBody>
      <FileSheet file={open} onClose={() => setOpenId(null)} onChanged={() => list.reload(true)} />
    </>
  )
}
