import { useState, useEffect } from 'react'

export function useThemeActive() {
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains('light-theme'))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains('light-theme'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isLight ? 'light' : 'dark'
}
