import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { inQuietHours } from '../lib/format'
import { reminders } from '../services'

const SEEN_KEY = 'alina.reminders.seen'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { return {} } }
const writeSeen = (o) => {
  const cutoff = Date.now() - 2 * 86400000
  const next = Object.fromEntries(Object.entries(o).filter(([, t]) => t > cutoff))
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

export async function showSystemNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) { await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/favicon.png' }); return true }
    new Notification(title, { body, tag, icon: '/icon-192.png' })
    return true
  } catch { return false }
}

/**
 * Honest in-app reminders: while Alina is open, fire a notification at the due time.
 * (The server worker handles push delivery; a closed browser tab cannot be woken up from here.)
 */
export default function useReminderWatcher() {
  const { status } = useAuth()
  const { settings, timezone } = useSettings()
  const toast = useToast()
  const timers = useRef(new Map())
  const quiet = useRef(settings.quiet_hours)
  quiet.current = settings.quiet_hours
  const tz = useRef(timezone)
  tz.current = timezone

  useEffect(() => {
    if (status !== 'authed') return undefined
    let alive = true

    const fire = (r) => {
      const key = `${r.id}@${r.next_fire_at}`
      const seen = readSeen()
      if (seen[key]) return
      seen[key] = Date.now(); writeSeen(seen)
      if (inQuietHours(quiet.current, tz.current)) return // respect quiet hours
      toast.info(`⏰ ${r.title}`, 12000)
      showSystemNotification('Alina reminder', r.title, r.id)
    }

    const sync = async () => {
      try {
        const page = await reminders.list({ status: 'scheduled', page_size: 100 })
        if (!alive) return
        const wanted = new Set()
        for (const r of page.items) {
          if (!r.next_fire_at) continue
          const due = new Date(r.next_fire_at).getTime()
          const delay = due - Date.now()
          const key = `${r.id}@${r.next_fire_at}`
          if (delay < -60000 || delay > 20 * 60000) continue // only the next 20 minutes; re-synced every minute
          wanted.add(key)
          if (!timers.current.has(key)) timers.current.set(key, setTimeout(() => { timers.current.delete(key); fire(r) }, Math.max(0, delay)))
        }
        for (const [key, t] of timers.current) if (!wanted.has(key)) { clearTimeout(t); timers.current.delete(key) }
      } catch { /* offline: try again next tick */ }
    }

    sync()
    const poll = setInterval(sync, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      for (const t of timers.current.values()) clearTimeout(t)
      timers.current.clear()
    }
  }, [status, toast])
}
