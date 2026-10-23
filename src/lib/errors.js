import { ApiError } from './api'

const MESSAGES = {
  ai_unavailable: "Alina's AI model isn't reachable right now. Make sure Ollama is running, then try again.",
  ai_model_missing: 'The configured AI model is not installed. Run `ollama pull <model>` on the server.',
  ai_timeout: 'The AI took too long to answer. Try a shorter message or try again.',
  database_unavailable: 'The database is temporarily unavailable. Please try again in a moment.',
  image_storage_unavailable: 'Image storage (Cloudinary) is not configured on the server.',
  stt_not_configured: "Speech-to-text isn't set up on the server.",
  tts_not_configured: "Text-to-speech isn't set up on the server.",
  stt_unavailable: 'The speech-to-text service is not responding.',
  tts_unavailable: 'The text-to-speech service is not responding.',
  video_not_supported: 'Video is not supported. Please use audio only.',
  no_speech_detected: "I couldn't hear any speech in that recording.",
  memory_consent_required: 'Memory is turned off. Turn it on first to let Alina remember things.',
  memory_paused: 'Memory is paused. Resume it to save new memories.',
  memory_contains_secret: 'That looks like a password, key or card number. Alina never stores secrets.',
  request_in_progress: 'Alina is still answering your previous message. Give it a moment.',
  payload_too_large: 'That file or message is too large.',
  network_error: "Can't reach the server. Check your connection and that the backend is running.",
  timeout: 'The server took too long to answer. Please try again.',
  invalid_credentials: 'Incorrect email or password.',
  token_reused: 'This session is no longer valid. Please sign in again.',
}

/** Turn any thrown value into a message that is safe and useful to show a person. */
export function friendly(err, fallback = 'Something went wrong. Please try again.') {
  if (!(err instanceof ApiError)) return err?.message || fallback
  if (err.code === 'rate_limited') {
    return err.retryAfter ? `Too many requests. Please wait ${err.retryAfter}s and try again.` : 'Too many requests. Please slow down a little.'
  }
  if (err.code === 'validation_error' && Array.isArray(err.details) && err.details.length) {
    const clean = (m) => String(m || '').replace(/^Value error,\s*/i, '')
    return err.details.map((d) => clean(d.message)).filter(Boolean).join(' · ') || err.message
  }
  return MESSAGES[err.code] || err.message || fallback
}

/** Field → message map for forms (from a 422 validation_error). */
export function fieldErrors(err) {
  const out = {}
  if (err instanceof ApiError && err.code === 'validation_error' && Array.isArray(err.details)) {
    for (const d of err.details) if (d.field && !out[d.field]) out[d.field] = String(d.message || '').replace(/^Value error,\s*/i, '')
  }
  return out
}