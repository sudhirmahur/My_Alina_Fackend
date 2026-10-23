// The access token lives only in memory. The refresh token is kept in localStorage so a
// reload keeps you signed in. (If you later move to cookies, only this file changes.)
const KEY = 'alina.refresh.v1'
let access = null

export const getAccess = () => access
export function getRefresh() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function setSession(tokens) {
  access = tokens.access_token
  try { localStorage.setItem(KEY, tokens.refresh_token) } catch { /* private mode */ }
}
export function clearSession() {
  access = null
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
