/**
 * RSB (Right Side Bar) Store — manages the slide-out info panel.
 *
 * Any page can open an info card via openEntityCard() or openProjectCard().
 * The RSB renders the appropriate card with scoped + global sections.
 * Scope tells the card what context to prioritize (collection, project).
 */
import { create } from 'zustand'

export interface RSBScope {
  collection?: string
  projectUniqueId?: string
  projectName?: string
}

interface RSBStore {
  isOpen: boolean
  cardType: 'entity' | 'project' | null
  name: string
  scope: RSBScope

  openEntityCard: (name: string, scope?: RSBScope) => void
  openProjectCard: (name: string, scope?: RSBScope) => void
  close: () => void
}

export const useRSBStore = create<RSBStore>((set) => ({
  isOpen: false,
  cardType: null,
  name: '',
  scope: {},

  openEntityCard: (name, scope = {}) => set({
    isOpen: true,
    cardType: 'entity',
    name,
    scope,
  }),

  openProjectCard: (name, scope = {}) => set({
    isOpen: true,
    cardType: 'project',
    name,
    scope,
  }),

  close: () => set({
    isOpen: false,
    // Keep cardType/name so close animation can finish with content visible
  }),
}))
