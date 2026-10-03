import { create } from 'zustand'

const SIDEBAR_KEY = 'nexari_sidebar_collapsed'

interface UIStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'true' } catch { return false }
}

function saveCollapsed(collapsed: boolean) {
  try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)) } catch { /* Session remains usable when storage is unavailable. */ }
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: readCollapsed(),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed
    saveCollapsed(next)
    return { sidebarCollapsed: next }
  }),

  setSidebarCollapsed: (collapsed) => {
    saveCollapsed(collapsed)
    set({ sidebarCollapsed: collapsed })
  },
}))
