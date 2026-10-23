import { useEffect } from 'react'

/** Keeps --vvh equal to the *visible* viewport height so the composer stays above the on-screen keyboard (iOS too). */
export default function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const root = document.documentElement
    const apply = () => {
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
      if (vv.offsetTop > 0) window.scrollTo(0, 0)
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      root.style.removeProperty('--vvh')
    }
  }, [])
}
