import { memo, useState } from 'react'
import { Bookmark, Check, Copy, FileText, RefreshCw, Square, Volume2 } from './icons'
import { Avatar, IconButton } from './ui'
import Markdown from '../lib/markdown'
import { cx } from '../lib/cx'
import { formatTime } from '../lib/format'

function Typing() {
  return <span className="inline-flex items-center gap-1 py-1.5" aria-label="Alina is thinking"><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
}

function MessageBubble({ msg, tz, isLast, speaking, onRetry, onSpeak, onRemember }) {
  const [copied, setCopied] = useState(false)
  const mine = msg.role === 'user'
  const failed = msg.status === 'failed'
  const waiting = msg.streaming && !msg.content

  const copy = async () => {
    try { await navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  if (mine) {
    return (
      <div className="rise flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[0.97rem] leading-relaxed text-accent-ink [overflow-wrap:anywhere] sm:max-w-[75%]">
          {msg.content}
        </div>
        {msg.created_at && <span className="px-1 text-[0.68rem] text-muted">{formatTime(msg.created_at, tz)}</span>}
      </div>
    )
  }

  const canAct = !msg.streaming && msg.content && !failed
  return (
    <div className="rise flex items-start gap-2.5">
      <Avatar size={32} className="mt-1" />
      <div className="min-w-0 max-w-[88%] sm:max-w-[78%]">
        <div className={cx('rounded-3xl rounded-tl-lg border px-4 py-2.5 text-[0.97rem] leading-relaxed',
          failed ? 'border-danger/40 bg-danger/10' : 'border-line bg-surface')}>
          {waiting ? <Typing /> : <Markdown text={msg.content} />}
          {msg.streaming && msg.content && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-accent" />}
          {msg.status === 'interrupted' && <p className="mt-1.5 text-xs italic text-muted">Stopped before finishing.</p>}
          {failed && (
            <div className="mt-1 space-y-2">
              <p className="text-sm text-danger">{msg.errorText || 'Alina could not reply.'}</p>
              {onRetry && <button onClick={onRetry} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-danger/15 px-3 text-sm font-medium text-danger"><RefreshCw className="size-4" />Try again</button>}
            </div>
          )}
        </div>
        {msg.sources?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => s?.filename && (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-muted"><FileText className="size-3" />{s.filename}</span>
            ))}
          </div>
        )}
        {canAct && (
          <div className="mt-1 flex items-center gap-0.5">
            <IconButton size="sm" icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy'} onClick={copy} className={copied ? 'text-ok' : ''} />
            <IconButton size="sm" icon={speaking ? Square : Volume2} label={speaking ? 'Stop speaking' : 'Read aloud'} onClick={() => onSpeak(msg)} active={speaking} />
            <IconButton size="sm" icon={Bookmark} label="Save to memory" onClick={() => onRemember(msg)} />
            {isLast && onRetry && msg.status === 'interrupted' && <IconButton size="sm" icon={RefreshCw} label="Regenerate" onClick={onRetry} />}
            {msg.created_at && <span className="ml-2 text-[0.68rem] text-muted">{formatTime(msg.created_at, tz)}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(MessageBubble)
