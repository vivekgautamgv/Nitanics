export type ThemeMode = 'light' | 'dark' | 'system'

export function getStoredTheme(): ThemeMode {
  let v: string | null = null
  try { v = localStorage.getItem('nexari_theme') } catch { /* Use default appearance when browser storage is unavailable. */ }
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'light'
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle('dark-theme', resolved === 'dark')
  try { localStorage.setItem('nexari_theme', mode) } catch { /* Theme changes still apply for this session. */ }
}

export function initTheme() {
  applyTheme(getStoredTheme())
}
