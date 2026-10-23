import { useCallback, useEffect, useRef, useState } from 'react'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
const pickMime = () => (typeof MediaRecorder === 'undefined' ? '' : MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m)) || '')

export const recordingSupported = () => !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')

/**
 * Push-to-talk recorder. start() asks for the microphone (only on a user tap), stop() resolves a Blob.
 * `level` (0..1) drives the mic animation; `error` is one of: denied | nodevice | unsupported | failed.
 */
export default function useVoiceRecorder({ maxSeconds = 110, onAutoStop } = {}) {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState(null)
  const rec = useRef(null)
  const chunks = useRef([])
  const stream = useRef(null)
  const raf = useRef(0)
  const timer = useRef(0)
  const ctx = useRef(null)
  const resolver = useRef(null)
  const autoStop = useRef(onAutoStop)
  autoStop.current = onAutoStop

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    ctx.current?.close?.().catch(() => {})
    ctx.current = null
    setLevel(0)
    setRecording(false)
  }, [])

  useEffect(() => () => { try { rec.current?.state !== 'inactive' && rec.current?.stop() } catch { /* */ } teardown() }, [teardown])

  const start = useCallback(async () => {
    setError(null)
    if (!recordingSupported()) { setError('unsupported'); return false }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const mime = pickMime()
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data) }
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' })
        teardown()
        resolver.current?.(blob)
        resolver.current = null
      }
      rec.current = r
      r.start(250)

      try { // level meter
        const AC = window.AudioContext || window.webkitAudioContext
        const ac = new AC()
        ctx.current = ac
        const an = ac.createAnalyser()
        an.fftSize = 256
        ac.createMediaStreamSource(s).connect(an)
        const buf = new Uint8Array(an.frequencyBinCount)
        const tick = () => {
          an.getByteFrequencyData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i]
          setLevel(Math.min(1, sum / buf.length / 110))
          raf.current = requestAnimationFrame(tick)
        }
        tick()
      } catch { /* meter is optional */ }

      setSeconds(0)
      setRecording(true)
      timer.current = setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= maxSeconds) { clearInterval(timer.current); queueMicrotask(() => autoStop.current?.()) }
          return n + 1
        })
      }, 1000)
      return true
    } catch (err) {
      teardown()
      setError(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied'
        : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' ? 'nodevice' : 'failed')
      return false
    }
  }, [maxSeconds, teardown])

  /** Stops and resolves the recorded Blob (or null if nothing was recording). */
  const stop = useCallback(() => new Promise((resolve) => {
    const r = rec.current
    if (!r || r.state === 'inactive') { resolve(null); return }
    resolver.current = resolve
    r.stop()
  }), [])

  const cancel = useCallback(() => {
    const r = rec.current
    resolver.current = null
    if (r && r.state !== 'inactive') { r.onstop = null; r.stop() }
    teardown()
  }, [teardown])

  return { start, stop, cancel, recording, level, seconds, error, supported: recordingSupported() }
}
