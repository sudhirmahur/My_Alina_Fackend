import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeCtx = createContext(null)
export const useTheme = () => useContext(ThemeCtx)
const KEY = 'alina.theme'

const read = () => { try { return localStorage.getItem(KEY) || 'dark' } catch { return 'dark' } }
const resolve = (t) => (t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(read)

  useEffect(() => {
    const apply = () => {
      const r = resolve(theme)
      document.documentElement.setAttribute('data-theme', r)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'light' ? '#fbf6f5' : '#0e0b0d')
    }
    apply()
    if (theme !== 'system') return undefined
    const mq = matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((t) => {
    try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
    setThemeState(t)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}
