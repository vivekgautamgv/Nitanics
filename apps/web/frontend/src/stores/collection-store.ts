/**
 * Collection Store — collection detail state + mutations
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from "zustand";
import { describeDataError } from "../adapters/neo4j-service";
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

let loadVersion = 0;
let activeCollection: string | null = null;

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
    const version = ++loadVersion;
    activeCollection = name;
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
      if (version !== loadVersion) return;
      set({
        summary,
        projects,
        bridges,
        topEntities,
        categories,
        chains,
        recommendations,
        isLoading: false,
        error: summary ? null : 'This collection could not be found. Refresh the workspace and choose another collection.',
      });
    } catch (err) {
      if (version === loadVersion) set({ error: describeDataError(err), isLoading: false });
    }
  },

  addProject: async (uniqueId: string, collectionName: string) => {
    await addProjectToCollection(uniqueId, collectionName);
    if (activeCollection === collectionName) await get().loadCollection(collectionName);
  },

  removeProject: async (uniqueId: string, collectionName: string) => {
    const removed = await removeProjectFromCollection(uniqueId, collectionName);
    if (removed && activeCollection === collectionName) await get().loadCollection(collectionName);
    return removed;
  },

  updateDescription: async (collectionName: string, description: string) => {
    await updateCollectionDescription(collectionName, description);
    const summary = get().summary;
    if (summary?.name === collectionName) {
      set({ summary: { ...summary, description } });
    }
  },
}));
