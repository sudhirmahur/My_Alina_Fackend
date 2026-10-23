import { clearSession, getAccess, getRefresh, setSession } from './session'

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, message, details = null, requestId = null, retryAfter = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
    this.retryAfter = retryAfter
  }
}

let authLostHandler = () => {}
export const onAuthLost = (fn) => { authLostHandler = fn }

async function readError(res) {
  const retryAfter = Number(res.headers.get('retry-after')) || null
  try {
    const body = await res.json()
    const e = body?.error || {}
    return new ApiError(res.status, e.code || 'http_error', e.message || res.statusText || 'Request failed',
      e.details ?? null, body?.request_id ?? null, retryAfter)
  } catch {
    return new ApiError(res.status, 'http_error', res.statusText || 'Request failed', null, null, retryAfter)
  }
}

// ---- token refresh (single flight: concurrent 401s share one refresh) ---------------------
let refreshing = null
export function refreshTokens() {
  if (refreshing) return refreshing
  const token = getRefresh()
  if (!token) return Promise.reject(new ApiError(401, 'not_authenticated', 'Please sign in.'))
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token }),
      })
      if (!res.ok) throw await readError(res)
      setSession(await res.json())
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        clearSession()
        authLostHandler()
      }
      if (err instanceof ApiError) throw err
      throw new ApiError(0, 'network_error', "Can't reach the server. Check your connection.")
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

const RETRY_ON = new Set(['token_expired', 'invalid_token', 'not_authenticated'])

function withTimeout(signal, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timed out', 'TimeoutError')), ms)
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason)
    else signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
  }
  return { signal: ctrl.signal, done: () => clearTimeout(timer) }
}

export function qs(params = {}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.append(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function send(path, { method = 'GET', json, form, signal, auth = true, timeout = 30000, stream = false }) {
  const headers = {}
  if (auth && getAccess()) headers.Authorization = `Bearer ${getAccess()}`
  let body
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  else if (form) body = form
  const t = withTimeout(signal, timeout)
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body, signal: t.signal })
    if (stream) t.done() // streaming responses run until the caller aborts
    return res
  } catch (err) {
    t.done()
    if (signal?.aborted) throw err
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'The server took too long to answer. Please try again.')
    }
    throw new ApiError(0, 'network_error', "Can't reach the server. Check your connection and that the backend is running.")
  } finally {
    if (!stream) t.done()
  }
}

/** Core request helper. Returns parsed JSON (or null for 204, or a Blob when `blob: true`). */
export async function request(path, opts = {}) {
  const { auth = true, blob = false } = opts
  if (auth && !getAccess() && getRefresh()) await refreshTokens()
  let res = await send(path, opts)
  if (res.status === 401 && auth && getRefresh()) {
    const err = await readError(res.clone())
    if (RETRY_ON.has(err.code)) {
      await refreshTokens()
      res = await send(path, opts)
    }
  }
  if (!res.ok) throw await readError(res)
  if (res.status === 204) return null
  if (blob) return res.blob()
  const type = res.headers.get('content-type') || ''
  return type.includes('application/json') ? res.json() : res.text()
}

export const get = (path, opts) => request(path, { ...opts, method: 'GET' })
export const post = (path, json, opts) => request(path, { ...opts, method: 'POST', json })
export const patch = (path, json, opts) => request(path, { ...opts, method: 'PATCH', json })
export const del = (path, opts) => request(path, { ...opts, method: 'DELETE' })
export const upload = (path, form, opts) => request(path, { timeout: 120000, ...opts, method: 'POST', form })

/**
 * Stream a chat reply over Server-Sent Events using fetch (EventSource cannot send auth headers).
 * Events: meta {chat_id,user_message_id,assistant_message_id} · token {text} · done {message} · error {code,message}
 */
export async function streamChat(body, { signal, onMeta, onToken, onDone, onError }) {
  if (!getAccess() && getRefresh()) await refreshTokens()
  let res = await send('/api/chat/stream', { method: 'POST', json: body, signal, stream: true })
  if (res.status === 401 && getRefresh()) {
    const err = await readError(res.clone())
    if (RETRY_ON.has(err.code)) { await refreshTokens(); res = await send('/api/chat/stream', { method: 'POST', json: body, signal, stream: true }) }
  }
  if (!res.ok) throw await readError(res)
  if (!res.body) throw new ApiError(0, 'stream_unsupported', 'This browser cannot stream replies.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  const dispatch = (raw) => {
    let event = 'message'
    const data = []
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return
    let payload
    try { payload = JSON.parse(data.join('\n')) } catch { return }
    if (event === 'meta') onMeta?.(payload)
    else if (event === 'token') onToken?.(payload.text || '')
    else if (event === 'done') { finished = true; onDone?.(payload) }
    else if (event === 'error') { finished = true; onError?.(payload) }
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '')
        dispatch(chunk)
      }
    }
    if (buffer.trim()) dispatch(buffer)
  } finally {
    reader.releaseLock?.()
  }
  if (!finished && !signal?.aborted) {
    onError?.({ code: 'stream_interrupted', message: 'The connection dropped before Alina finished replying.' })
  }
}
