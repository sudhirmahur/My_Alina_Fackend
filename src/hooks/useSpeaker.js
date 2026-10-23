import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { voice } from '../services'

let backendTts = null // null = unknown, true/false after first check

const LANG = { hi: 'hi-IN', en: 'en-US', hinglish: 'en-IN' }

/** Speaks text through the server's TTS when configured, otherwise the browser's speech synthesis. */
export default function useSpeaker() {
  const { settings } = useSettings()
  const [speakingId, setSpeakingId] = useState(null)
  const [source, setSource] = useState(null) // 'server' | 'browser'
  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const tokenRef = useRef(0)

  const cleanup = useCallback(() => {
    tokenRef.current++
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    window.speechSynthesis?.cancel()
  }, [])

  const stop = useCallback(() => { cleanup(); setSpeakingId(null); setSource(null) }, [cleanup])
  useEffect(() => cleanup, [cleanup])

  const speakBrowser = useCallback((text, id, token) => new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) { resolve(false); return }
    const u = new SpeechSynthesisUtterance(text.replace(/[`*_#>]/g, ''))
    u.lang = LANG[settings.language] || navigator.language || 'en-US'
    u.rate = settings.voice?.speed || 1
    u.onend = () => { if (token === tokenRef.current) { setSpeakingId(null); setSource(null) } resolve(true) }
    u.onerror = () => { if (token === tokenRef.current) { setSpeakingId(null); setSource(null) } resolve(true) }
    setSource('browser'); setSpeakingId(id)
    synth.speak(u)
  }), [settings.language, settings.voice?.speed])

  /** Resolves true when playback finished (or was handed to the browser), false if nothing could speak. */
  const speak = useCallback(async (text, id = 'x') => {
    cleanup()
    const token = tokenRef.current
    setSpeakingId(id)
    if (backendTts !== false) {
      try {
        const blob = await voice.speak(text, {
          voice: settings.voice?.voice_id || undefined, speed: settings.voice?.speed || undefined,
        })
        if (token !== tokenRef.current) return true
        backendTts = true
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        setSource('server')
        await new Promise((resolve) => {
          audio.onended = resolve
          audio.onerror = resolve
          audio.play().catch(resolve)
        })
        if (token === tokenRef.current) { setSpeakingId(null); setSource(null) }
        return true
      } catch (err) {
        if (token !== tokenRef.current) return true
        if (err?.code === 'tts_not_configured') backendTts = false
        // fall through to the browser voice for any TTS failure
      }
    }
    return speakBrowser(text, id, token)
  }, [cleanup, settings.voice?.voice_id, settings.voice?.speed, speakBrowser])

  return { speak, stop, speakingId, source, supported: backendTts !== false || !!window.speechSynthesis }
}
