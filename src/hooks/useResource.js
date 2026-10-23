import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal data-loading hook: { data, error, loading, reload, setData }. Ignores stale responses. */
export default function useResource(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const run = useRef(0)
  const fn = useRef(fetcher)
  fn.current = fetcher

  const load = useCallback(async (silent = false) => {
    const id = ++run.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fn.current()
      if (id === run.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (id === run.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) { setState({ data: null, error: null, loading: false }); return undefined }
    load()
    return () => { run.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }))
  }, [])

  return { ...state, reload: load, setData }
}
