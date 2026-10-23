import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, MessageCircle, Mic, Send, Square, X } from '../components/icons'
import { Avatar, Badge, Button, Card, Switch, Textarea } from '../components/ui'
import { useSettings } from '../context/SettingsContext'
import useLocalSetting from '../hooks/useLocalSetting'
import useResource from '../hooks/useResource'
import useSpeaker from '../hooks/useSpeaker'
import useVoiceRecorder from '../hooks/useVoiceRecorder'
import { cx } from '../lib/cx'
import { chatsChanged } from '../lib/events'
import { friendly } from '../lib/errors'
import { newId } from '../lib/format'
import Markdown from '../lib/markdown'
import { chats, voice } from '../services'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const BCP47 = { hi: 'hi-IN', en: 'en-US', hinglish: 'en-IN' }

const LABELS = {
  idle: ['Tap to talk', 'Alina listens only while you hold the conversation open.'],
  listening: ['Listening…', 'Tap the square when you are done speaking.'],
  transcribing: ['Transcribing…', 'Turning your voice into text.'],
  review: ['Check what I heard', 'Fix anything, then send.'],
  thinking: ['Thinking…', 'Alina is writing a reply.'],
  speaking: ['Speaking…', 'Tap to stop.'],
}

const MIC_ERRORS = {
  denied: 'Microphone access was blocked. Allow it in your browser’s site settings — you can always type to Alina instead.',
  nodevice: 'No microphone was found on this device.',
  unsupported: 'This browser can’t record audio. You can type to Alina instead.',
  insecure: 'The microphone only works on a secure connection (HTTPS or localhost). Open Alina over HTTPS to use voice.',
  failed: 'The microphone could not be started. Please try again.',
}

function Waves({ active, level }) {
  return (
    <div className="flex h-8 items-center justify-center gap-1.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={cx('w-1.5 rounded-full bg-accent', active && 'wave-bar')}
          style={{ height: active ? '100%' : `${20 + (level ? level * 60 : 0)}%`, animationDelay: `${i * 0.12}s`, opacity: active ? 1 : 0.35 }} />
      ))}
    </div>
  )
}

export default function Voice() {
  const { settings } = useSettings()
  const status = useResource(() => voice.status(), [])
  const speaker = useSpeaker()
  const [reviewMode, setReviewMode] = useLocalSetting('alina.voice.review', false)
  const [speakReplies, setSpeakReplies] = useLocalSetting('alina.voice.speak', true)
  const [phase, setPhaseState] = useState('idle')
  const [said, setSaid] = useState('')
  const [reply, setReply] = useState('')
  const [draft, setDraft] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)

  const phaseRef = useRef('idle')
  const chatIdRef = useRef(null)
  const abortRef = useRef(null)
  const recogRef = useRef(null)
  const finalRef = useRef('')
  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p) }

  const serverStt = !!status.data?.stt?.available
  const engine = serverStt ? 'server' : SR ? 'browser' : null
  const lang = settings.language === 'hi' || settings.language === 'en' ? settings.language : undefined

  const reset = useCallback((msg = null) => { setPhase('idle'); setInterim(''); setError(msg) }, [])

  // ---- the conversation turn: text -> chat -> (speak)
  const sendText = useCallback(async (text) => {
    const clean = text.trim()
    if (!clean) { reset(); return }
    setSaid(clean); setReply(''); setError(null); setPhase('thinking')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await chats.send({ chat_id: chatIdRef.current || undefined, message: clean, client_message_id: newId() }, ctrl.signal)
      chatIdRef.current = res.chat.id
      const text2 = res.assistant_message.content
      setReply(text2); chatsChanged()
      if (speakReplies && text2) {
        setPhase('speaking')
        const ok = await speaker.speak(text2, 'voice')
        if (!ok) setError('This device has no speech output, so I could only show the reply.')
      }
      if (phaseRef.current !== 'idle') setPhase('idle')
    } catch (err) {
      if (ctrl.signal.aborted) return
      reset(friendly(err))
    } finally { abortRef.current = null }
  }, [reset, speakReplies, speaker])

  const afterTranscript = useCallback((text) => {
    if (!text.trim()) { reset("I didn't catch anything. Tap the mic and try again."); return }
    if (reviewMode) { setDraft(text.trim()); setPhase('review') } else sendText(text)
  }, [reset, reviewMode, sendText])

  const transcribe = useCallback(async (blob) => {
    setPhase('transcribing')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await voice.transcribe(blob, lang, ctrl.signal)
      abortRef.current = null
      afterTranscript(res.text || '')
    } catch (err) {
      if (ctrl.signal.aborted) return
      abortRef.current = null
      reset(friendly(err))
    }
  }, [afterTranscript, lang, reset])

  const recorder = useVoiceRecorder({ onAutoStop: () => finish() }) // eslint-disable-line no-use-before-define

  // ---- controls
  const begin = async () => {
    setError(null); setSaid(''); setReply(''); setInterim('')
    if (!window.isSecureContext && engine !== 'browser') { setError(MIC_ERRORS.insecure); return }
    if (engine === 'server') {
      const ok = await recorder.start()
      if (ok) setPhase('listening')
      else setError(MIC_ERRORS[recorder.error] || MIC_ERRORS.failed)
    } else if (engine === 'browser') {
      const r = new SR()
      recogRef.current = r
      finalRef.current = ''
      r.lang = BCP47[settings.language] || navigator.language || 'en-US'
      r.interimResults = true
      r.continuous = false
      r.onresult = (e) => {
        let t = ''
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
        setInterim(t)
        if (e.results[e.results.length - 1].isFinal) finalRef.current = t
      }
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') reset(MIC_ERRORS.denied)
        else if (e.error === 'no-speech') reset("I didn't hear anything. Tap the mic and try again.")
        else if (e.error !== 'aborted') reset('Speech recognition failed. Please try again.')
      }
      r.onend = () => { if (phaseRef.current === 'listening') { setInterim(''); afterTranscript(finalRef.current) } }
      try { r.start(); setPhase('listening') } catch { reset(MIC_ERRORS.failed) }
    }
  }

  async function finish() {
    if (phaseRef.current !== 'listening') return
    if (engine === 'server') {
      const blob = await recorder.stop()
      if (!blob || blob.size < 1500) { reset("That was too short. Tap the mic and speak a little longer."); return }
      transcribe(blob)
    } else recogRef.current?.stop()
  }

  const cancel = () => {
    abortRef.current?.abort(); abortRef.current = null
    recorder.cancel()
    try { recogRef.current?.abort() } catch { /* ignore */ }
    speaker.stop()
    reset()
  }

  useEffect(() => () => { abortRef.current?.abort(); try { recogRef.current?.abort() } catch { /* ignore */ } }, [])

  const onOrb = () => {
    if (phase === 'idle') begin()
    else if (phase === 'listening') finish()
    else if (phase === 'speaking' || phase === 'thinking' || phase === 'transcribing') cancel()
  }

  const [title, hint] = LABELS[phase]
  const active = phase !== 'idle' && phase !== 'review'
  const OrbIcon = phase === 'idle' ? Mic : phase === 'listening' || phase === 'speaking' ? Square : X
  const scale = phase === 'listening' ? 1 + recorder.level * 0.16 : 1

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-safe">
      <header className="flex items-center justify-between pb-2 pt-5">
        <h1 className="font-display text-[1.45rem] font-semibold">Voice</h1>
        <div className="flex items-center gap-2">
          {engine === 'browser' && <Badge tone="warn">Browser speech</Badge>}
          {status.data && !status.data.tts?.available && <Badge>Device voice</Badge>}
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-4">
        <div className="relative grid place-items-center" style={{ width: 232, height: 232 }}>
          {(phase === 'listening' || phase === 'speaking') && <span className="ring-pulse absolute inset-6 rounded-full" aria-hidden />}
          {(phase === 'transcribing' || phase === 'thinking') && <span className="spin-slow absolute inset-1 rounded-full border-2 border-dashed border-accent/50" aria-hidden />}
          <div className="transition-transform duration-100" style={{ transform: `scale(${scale})` }}>
            <Avatar size={176} glow={active} />
          </div>
        </div>

        <p className="mt-6 font-display text-2xl font-semibold" aria-live="polite">{title}</p>
        <p className="mt-1 max-w-xs text-center text-sm text-muted">{phase === 'listening' && interim ? `“${interim}”` : hint}</p>
        <div className="mt-3 h-8">{(phase === 'listening' || phase === 'speaking') && <Waves active={phase === 'speaking' || recorder.recording === false} level={recorder.level} />}</div>

        {phase === 'review' ? (
          <div className="mt-2 w-full space-y-3">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Transcript" />
            <div className="flex gap-3">
              <Button variant="soft" className="flex-1" icon={X} onClick={() => reset()}>Discard</Button>
              <Button className="flex-1" icon={Send} disabled={!draft.trim()} onClick={() => sendText(draft)}>Send</Button>
            </div>
          </div>
        ) : (
          <button onClick={onOrb} disabled={!engine && phase === 'idle'}
            aria-label={phase === 'idle' ? 'Start talking' : phase === 'listening' ? 'Stop and send' : 'Cancel'}
            className={cx('mt-2 grid size-20 place-items-center rounded-full transition active:scale-90 disabled:opacity-40',
              phase === 'idle' ? 'bg-accent text-accent-ink shadow-[0_12px_36px_-10px_var(--accent)]' : 'bg-raised text-accent ring-2 ring-accent/50')}>
            <OrbIcon className={cx('size-8', OrbIcon === Square && 'fill-current')} />
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="mb-3 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" /><p className="flex-1 leading-snug">{error}</p>
        </div>
      )}
      {!status.loading && !engine && (
        <Card className="mb-3 flex gap-3 text-sm leading-relaxed">
          <Info className="mt-0.5 size-5 shrink-0 text-warn" />
          <p className="text-muted">Voice input isn’t set up on this server and your browser has no built-in speech recognition. Alina’s text chat still works.</p>
        </Card>
      )}
      {engine === 'browser' && (
        <p className="mb-3 text-center text-xs leading-relaxed text-muted">The server has no speech-to-text, so your browser’s own recognition is used. Depending on your browser, it may send audio to its vendor.</p>
      )}

      {(said || reply) && (
        <Card className="rise mb-3 space-y-3">
          {said && <div><p className="text-xs font-medium uppercase tracking-wide text-muted">You said</p><p className="mt-1 text-[0.95rem]">{said}</p></div>}
          {reply && <div><p className="text-xs font-medium uppercase tracking-wide text-accent">Alina</p><div className="mt-1 text-[0.95rem] leading-relaxed"><Markdown text={reply} /></div></div>}
        </Card>
      )}

      <Card className="divide-y divide-line/70 !py-1">
        <Switch checked={speakReplies} onChange={setSpeakReplies} label="Read replies aloud" />
        <Switch checked={reviewMode} onChange={setReviewMode} label="Review before sending" description="Check and fix the transcript first." />
      </Card>

      <Link to={`/chat/${chatIdRef.current || 'new'}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-medium text-accent">
        <MessageCircle className="size-4" />{reply ? 'Continue in chat' : 'Type instead'}
      </Link>
    </main>
  )
}
