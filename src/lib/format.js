const TZ_ALIASES = {
  'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon', 'Europe/Kiev': 'Europe/Kyiv', 'Asia/Dacca': 'Asia/Dhaka',
}
export const browserTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    return TZ_ALIASES[tz] || tz
  } catch { return 'UTC' }
}

export function timezones() {
  try {
    const list = Intl.supportedValuesOf?.('timeZone')
    if (list?.length) return list
  } catch { /* old browser */ }
  return ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York',
    'America/Chicago', 'America/Los_Angeles', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney']
}

export function greeting(date = new Date(), tz) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(date)) % 24
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

export function formatDateTime(iso, tz, opts = {}) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz, ...opts,
    }).format(new Date(iso))
  } catch { return new Date(iso).toLocaleString() }
}

export const formatTime = (iso, tz, opts = {}) => formatDateTime(iso, tz, { weekday: undefined, day: undefined, month: undefined, ...opts })
export const formatDate = (iso, tz, opts = {}) => formatDateTime(iso, tz, { hour: undefined, minute: undefined, ...opts })

export function relativeTime(iso) {
  if (!iso) return ''
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < 45) return rtf.format(0, 'second') === 'now' ? 'just now' : rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return formatDateTime(iso, undefined, { weekday: undefined, hour: undefined, minute: undefined, year: 'numeric' })
}

export function formatBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const pad = (n) => String(n).padStart(2, '0')

/** "YYYY-MM-DDTHH:mm" wall-clock time of an instant in a time zone (value for <input type="datetime-local">). */
export function toNaiveLocal(isoOrDate, tz) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d)
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]))
    return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`
  } catch {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

/** Date part (YYYY-MM-DD) of "now" in a time zone. */
export const todayIn = (tz) => toNaiveLocal(new Date(), tz).slice(0, 10)

export function isToday(iso, tz) {
  return !!iso && toNaiveLocal(iso, tz).slice(0, 10) === todayIn(tz)
}

export const newId = () => {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('') // 24 chars, [a-f0-9]
}

export function inQuietHours(quiet, tz, date = new Date()) {
  if (!quiet?.enabled) return false
  const now = toNaiveLocal(date, tz).slice(11, 16)
  const { start, end } = quiet
  return start <= end ? now >= start && now < end : now >= start || now < end
}

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A'