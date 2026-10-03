import { useEffect, useRef } from 'react'

/** Reload local data after returning from an external agent, without background polling. */
export function useRefreshOnFocus(refresh: () => void): void {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    let lastRefresh = 0
    const refreshVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      // Browsers often emit focus and visibilitychange for the same return.
      if (now - lastRefresh < 1000) return
      lastRefresh = now
      refreshRef.current()
    }
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [])
}
