import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { browserTimezone } from '../lib/format'
import { settings as api } from '../services'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)
export const useSettings = () => useContext(Ctx)

const FALLBACK = {
  language: 'auto', timezone: browserTimezone(),
  personality: { preset: 'friendly', custom_instructions: null },
  voice: { voice_id: null, speed: 1, auto_speak: false },
  quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
  privacy: { memory_consent: false, allow_sensitive_memory: false, use_memory_in_chat: true, save_voice_recordings: false },
  memory_paused: false,
}

export function SettingsProvider({ children }) {
  const { status } = useAuth()
  const [settings, setSettings] = useState(null)

  const load = useCallback(() => api.get().then(setSettings).catch(() => setSettings((s) => s || null)), [])
  useEffect(() => {
    if (status === 'authed') load()
    else setSettings(null)
  }, [status, load])

  /** Partial update (server merges). Returns the saved settings. */
  const update = useCallback(async (patch) => {
    const saved = await api.update(patch)
    setSettings(saved)
    return saved
  }, [])

  const value = useMemo(() => ({
    settings: settings || FALLBACK, loaded: !!settings, update, reload: load,
    timezone: (settings || FALLBACK).timezone || browserTimezone(),
  }), [settings, update, load])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
