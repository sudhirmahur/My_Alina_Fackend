import { Fragment } from 'react'

// A small, safe Markdown renderer (no innerHTML). Supports paragraphs, headings, lists,
// fenced code, inline code, bold, italic and http(s) links — enough for chat replies.

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<)]+)/g

function inline(text, keyBase) {
  const out = []
  let last = 0
  let m
  let i = 0
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (m[1]) out.push(<code key={key} className="rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>)
    else if (m[3]) out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    else if (m[4]) {
      const [, label, url] = tok.match(/^\[([^\]]+)\]\((.+)\)$/)
      out.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-accent/60 underline-offset-2 hover:decoration-accent">{label}</a>)
    } else out.push(<a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-accent/60 underline-offset-2">{tok}</a>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function parseBlocks(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const code = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++])
      i++ // closing fence (may be missing while streaming)
      blocks.push({ type: 'code', lang: fence[1], text: code.join('\n') })
      continue
    }
    if (!line.trim()) { i++; continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2] }); i++; continue }
    if (/^\s*([-*•])\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•])\s+/, ''))
      blocks.push({ type: 'ul', items }); continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push({ type: 'ol', items }); continue
    }
    if (/^>\s?/.test(line)) {
      const q = []
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push({ type: 'quote', text: q.join('\n') }); continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^(#{1,4})\s+/.test(lines[i])
      && !/^\s*([-*•])\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^>\s?/.test(lines[i])) para.push(lines[i++])
    blocks.push({ type: 'p', text: para.join('\n') })
  }
  return blocks
}

function lines(text, key) {
  return text.split('\n').map((l, idx, arr) => (
    <Fragment key={`${key}-${idx}`}>{inline(l, `${key}-${idx}`)}{idx < arr.length - 1 && <br />}</Fragment>
  ))
}

export default function Markdown({ text }) {
  const blocks = parseBlocks(text || '')
  return (
    <div className="space-y-2.5 break-words [overflow-wrap:anywhere]">
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          return (
            <pre key={i} className="scroll-thin overflow-x-auto rounded-xl bg-black/35 p-3 font-mono text-[0.82rem] leading-relaxed">
              <code>{b.text}</code>
            </pre>
          )
        }
        if (b.type === 'heading') return <p key={i} className="font-display text-base font-semibold">{inline(b.text, `h${i}`)}</p>
        if (b.type === 'ul') return <ul key={i} className="list-disc space-y-1 pl-5 marker:text-accent">{b.items.map((t, j) => <li key={j}>{inline(t, `u${i}-${j}`)}</li>)}</ul>
        if (b.type === 'ol') return <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-accent">{b.items.map((t, j) => <li key={j}>{inline(t, `o${i}-${j}`)}</li>)}</ol>
        if (b.type === 'quote') return <blockquote key={i} className="border-l-2 border-accent/60 pl-3 text-muted">{lines(b.text, `q${i}`)}</blockquote>
        return <p key={i}>{lines(b.text, `p${i}`)}</p>
      })}
    </div>
  )
}
