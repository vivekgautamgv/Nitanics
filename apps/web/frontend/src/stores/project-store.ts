/**
 * Project Store — project detail state
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from 'zustand'
import {
  fetchProjectDetail, fetchProjectEntities, fetchProjectRelationships,
  fetchRelatedProjects, fetchProjectChains, fetchProjectTimeline,
} from '../services/frontend-queries'
import type {
  ProjectEntity, ProjectRelationship, TimelineEvent,
  RelatedProject, CausalChainItem,
} from '../types/frontend'

interface ProjectDetail {
  name: string
  uniqueId: string
  summary: string
  narrativeFlow: string[]
  domain: string
  subdomain: string
  baseTags: string[]
  htmlPath: string
  directory: string
  collections: string[]
  createdDate: string | null
}

interface ProjectStore {
  detail: ProjectDetail | null
  entities: ProjectEntity[]
  relationships: ProjectRelationship[]
  relatedProjects: RelatedProject[]
  chains: CausalChainItem[]
  timeline: TimelineEvent[]
  isLoading: boolean
  error: string | null

  loadProject: (uniqueId: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  detail: null,
  entities: [],
  relationships: [],
  relatedProjects: [],
  chains: [],
  timeline: [],
  isLoading: false,
  error: null,

  loadProject: async (uniqueId: string) => {
    set({
      isLoading: true, error: null,
      detail: null, entities: [], relationships: [],
      relatedProjects: [], chains: [], timeline: [],
    })
    try {
      const [detail, entities, relationships, relatedProjects, chains, timeline] =
        await Promise.all([
          fetchProjectDetail(uniqueId),
          fetchProjectEntities(uniqueId),
          fetchProjectRelationships(uniqueId),
          fetchRelatedProjects(uniqueId),
          fetchProjectChains(uniqueId),
          fetchProjectTimeline(uniqueId),
        ])
      set({
        detail,
        entities,
        relationships,
        relatedProjects,
        chains,
        timeline,
        isLoading: false,
      })
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },
}))
