/**
 * Entity Store — entity profile state
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from 'zustand'
import { fetchEntityProfile } from '../services/frontend-queries'
import type {
  EntityProjectMention, EntityRelationship, EntityChainLink, SimilarEntity,
} from '../types/frontend'

interface EntityProfile {
  name: string
  category: string
  definition: string
  aliases: string[]
  pageRank: number
  betweenness: number
  degree: number
  projectCount: number
  bridgeTier: 'gold' | 'silver' | 'bronze' | 'none'
  projects: EntityProjectMention[]
  collections: string[]
  relationships: EntityRelationship[]
  chainLinks: EntityChainLink[]
  similarEntities: SimilarEntity[]
}

interface EntityStore {
  profile: EntityProfile | null
  isLoading: boolean
  error: string | null

  loadEntity: (name: string) => Promise<void>
}

export const useEntityStore = create<EntityStore>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadEntity: async (name: string) => {
    set({ isLoading: true, error: null, profile: null })
    try {
      const profile = await fetchEntityProfile(name)
      set({ profile, isLoading: false })
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },
}))
