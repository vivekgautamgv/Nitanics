/**
 * Collection Store — collection detail state + mutations
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from "zustand";
import {
  fetchCollectionSummary,
  fetchCollectionProjects,
  fetchCollectionBridges,
  fetchProjectRecommendations,
  fetchCollectionTopEntities,
  fetchCollectionCategories,
  fetchCollectionChains,
  addProjectToCollection,
  removeProjectFromCollection,
  getProjectCollectionCount,
  updateCollectionDescription,
} from "../services/frontend-queries";
import type {
  CollectionProject,
  BridgeEntityItem,
  TopEntityItem,
  CategoryCount,
  CausalChainItem,
  ProjectRecommendation,
} from "../types/frontend";

interface CollectionSummary {
  name: string;
  description: string | null;
  projectCount: number;
  entityCount: number;
  relationshipCount: number;
  causalChainCount: number;
}

interface CollectionStore {
  summary: CollectionSummary | null;
  projects: CollectionProject[];
  bridges: BridgeEntityItem[];
  topEntities: TopEntityItem[];
  categories: CategoryCount[];
  chains: CausalChainItem[];
  recommendations: ProjectRecommendation[];
  isLoading: boolean;
  error: string | null;

  loadCollection: (name: string) => Promise<void>;
  addProject: (uniqueId: string, collectionName: string) => Promise<void>;
  removeProject: (uniqueId: string, collectionName: string) => Promise<boolean>;
  updateDescription: (
    collectionName: string,
    description: string,
  ) => Promise<void>;
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  summary: null,
  projects: [],
  bridges: [],
  topEntities: [],
  categories: [],
  chains: [],
  recommendations: [],
  isLoading: false,
  error: null,

  loadCollection: async (name: string) => {
    set({
      isLoading: true,
      error: null,
      summary: null,
      projects: [],
      bridges: [],
      topEntities: [],
      categories: [],
      chains: [],
      recommendations: [],
    });
    try {
      const [
        summary,
        projects,
        bridges,
        topEntities,
        categories,
        chains,
        recommendations,
      ] = await Promise.all([
        fetchCollectionSummary(name),
        fetchCollectionProjects(name),
        fetchCollectionBridges(name),
        fetchCollectionTopEntities(name),
        fetchCollectionCategories(name),
        fetchCollectionChains(name),
        fetchProjectRecommendations(name),
      ]);
      set({
        summary,
        projects,
        bridges,
        topEntities,
        categories,
        chains,
        recommendations,
        isLoading: false,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addProject: async (uniqueId: string, collectionName: string) => {
    await addProjectToCollection(uniqueId, collectionName);
    await get().loadCollection(collectionName);
  },

  removeProject: async (uniqueId: string, collectionName: string) => {
    const count = await getProjectCollectionCount(uniqueId);
    if (count <= 1) return false; // Can't remove from last collection
    await removeProjectFromCollection(uniqueId, collectionName);
    await get().loadCollection(collectionName);
    return true;
  },

  updateDescription: async (collectionName: string, description: string) => {
    await updateCollectionDescription(collectionName, description);
    const summary = get().summary;
    if (summary) {
      set({ summary: { ...summary, description } });
    }
  },
}));
