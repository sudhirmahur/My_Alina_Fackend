import { useCallback, useState } from 'react'

/** useState that persists a small per-device preference in localStorage. */
export default function useLocalSetting(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v === null ? initial : JSON.parse(v) } catch { return initial }
  })
  const set = useCallback((next) => {
    setValue(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }, [key])
  return [value, set]
}
