import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from '../components/icons'
import { cx } from '../lib/cx'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

const STYLE = {
  success: ['text-ok', CheckCircle2],
  error: ['text-danger', AlertTriangle],
  info: ['text-accent', Info],
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback((kind, message, ms = 4200) => {
    const id = ++seq.current
    setItems((l) => [...l.slice(-3), { id, kind, message }])
    if (ms) setTimeout(() => dismiss(id), ms)
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    success: (m, ms) => push('success', m, ms),
    error: (m, ms) => push('error', m, ms ?? 6500),
    info: (m, ms) => push('info', m, ms),
    dismiss,
  }), [push, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
        aria-live="polite" aria-atomic="false">
        {items.map((t) => {
          const [color, Icon] = STYLE[t.kind]
          return (
            <div key={t.id} role="status"
              className="toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-line bg-raised/95 px-4 py-3 text-sm shadow-xl backdrop-blur">
              <Icon className={cx('mt-0.5 size-5 shrink-0', color)} />
              <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-1 rounded-lg p-1 text-muted hover:text-ink"><X className="size-4" /></button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
