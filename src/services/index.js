// One thin function per backend endpoint. Components never build URLs themselves.
import { del, get, patch, post, qs, request, streamChat, upload } from '../lib/api'
import { clearSession, getRefresh, setSession } from '../lib/session'

// ---------------------------------------------------------------- auth
export const auth = {
  async register(body) { const s = await post('/api/auth/register', body, { auth: false }); setSession(s.tokens); return s.user },
  async login(body) { const s = await post('/api/auth/login', body, { auth: false }); setSession(s.tokens); return s.user },
  me: () => get('/api/auth/me'),
  updateProfile: (body) => patch('/api/auth/me', body),
  async logout(allDevices = false) {
    const refresh_token = getRefresh()
    try { if (refresh_token) await post('/api/auth/logout', { refresh_token, all_devices: allDevices }, { auth: !!allDevices }) } catch { /* sign out locally anyway */ }
    clearSession()
  },
  forgot: (email) => post('/api/auth/forgot-password', { email }, { auth: false }),
  reset: (token, new_password) => post('/api/auth/reset-password', { token, new_password }, { auth: false }),
  deleteAccount: (password) => del('/api/auth/account', { json: { password, confirmation: 'DELETE MY ACCOUNT' } }),
}

// ---------------------------------------------------------------- chats
export const chats = {
  list: (p = {}) => get(`/api/chats${qs({ page: 1, page_size: 20, ...p })}`),
  create: (title) => post('/api/chats', title ? { title } : {}),
  get: (id) => get(`/api/chats/${id}`),
  rename: (id, title) => patch(`/api/chats/${id}`, { title }),
  archive: (id, archived) => patch(`/api/chats/${id}`, { archived }),
  remove: (id) => del(`/api/chats/${id}`),
  messages: (id, p = {}) => get(`/api/chats/${id}/messages${qs({ page: 1, page_size: 40, order: 'desc', ...p })}`),
  clear: (id) => del(`/api/chats/${id}/messages`),
  send: (body, signal) => post('/api/chat', body, { timeout: 150000, signal }),
  stream: streamChat,
}

// ---------------------------------------------------------------- memory
export const memory = {
  status: () => get('/api/memory/status'),
  pause: () => post('/api/memory/pause'),
  resume: (grant_consent = false) => post('/api/memory/resume', { grant_consent }),
  list: (p = {}) => get(`/api/memory${qs({ page: 1, page_size: 100, ...p })}`),
  create: (body) => post('/api/memory', body),
  update: (id, body) => patch(`/api/memory/${id}`, body),
  remove: (id) => del(`/api/memory/${id}`),
  clearAll: () => del('/api/memory'),
  search: (query, limit = 5) => post('/api/memory/search', { query, limit }),
}

// ---------------------------------------------------------------- files & images
export const files = {
  list: (p = {}) => get(`/api/files${qs({ page: 1, page_size: 100, ...p })}`),
  get: (id) => get(`/api/files/${id}`),
  status: (id) => get(`/api/files/${id}/status`),
  upload(file) { const f = new FormData(); f.append('file', file); return upload('/api/files/upload', f) },
  reprocess: (id) => post(`/api/files/${id}/reprocess`),
  ask: (id, question) => post(`/api/files/${id}/ask`, { question }, { timeout: 150000 }),
  content: (id, offset = 0, limit = 20000) => get(`/api/files/${id}/content${qs({ offset, limit })}`),
  remove: (id) => del(`/api/files/${id}`),
}

export const images = {
  list: (p = {}) => get(`/api/images${qs({ page: 1, page_size: 60, ...p })}`),
  upload(file, alt_text) {
    const f = new FormData(); f.append('file', file)
    if (alt_text) f.append('alt_text', alt_text)
    return upload('/api/images/upload', f)
  },
  remove: (id) => del(`/api/images/${id}`),
}

// ---------------------------------------------------------------- voice
export const voice = {
  status: () => get('/api/voice/status'),
  voices: () => get('/api/voice/voices'),
  transcribe(blob, language, signal) {
    const f = new FormData()
    f.append('file', blob, `recording.${extFor(blob.type)}`)
    if (language) f.append('language', language)
    return upload('/api/voice/transcribe', f, { signal })
  },
  speak: (text, opts = {}, signal) => request('/api/voice/speak', { method: 'POST', json: { text: text.slice(0, 2000), ...opts }, blob: true, timeout: 90000, signal }),
}

function extFor(type = '') {
  if (type.includes('webm')) return 'webm'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a'
  if (type.includes('wav')) return 'wav'
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3'
  return 'webm'
}

// ---------------------------------------------------------------- tasks & reminders
export const tasks = {
  list: (p = {}) => get(`/api/tasks${qs({ page: 1, page_size: 100, ...p })}`),
  create: (body) => post('/api/tasks', body),
  update: (id, body) => patch(`/api/tasks/${id}`, body),
  remove: (id) => del(`/api/tasks/${id}`),
}

export const reminders = {
  list: (p = {}) => get(`/api/reminders${qs({ page: 1, page_size: 100, ...p })}`),
  create: (body) => post('/api/reminders', body),
  update: (id, body) => patch(`/api/reminders/${id}`, body),
  snooze: (id, minutes) => post(`/api/reminders/${id}/snooze`, { minutes }),
  remove: (id) => del(`/api/reminders/${id}`),
}

// ---------------------------------------------------------------- settings, AI, health
export const settings = {
  get: () => get('/api/settings'),
  update: (body) => patch('/api/settings', body),
}

export const ai = {
  status: () => get('/api/ai/status', { timeout: 15000 }),
  models: () => get('/api/ai/models', { timeout: 15000 }),
}

export const health = {
  live: () => get('/health', { auth: false, timeout: 8000 }),
  db: () => get('/api/health/db', { auth: false, timeout: 8000 }),
  storage: () => get('/api/health/storage', { auth: false, timeout: 8000 }),
}
