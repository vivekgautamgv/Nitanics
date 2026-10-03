/**
 * Directory Store — home screen + directory detail state
 * Source of truth: DESIGN-SPEC.md Section 16
 */
import { create } from 'zustand'
import { describeDataError } from '../adapters/neo4j-service'
import {
  fetchAllDirectories, fetchAllCollections,
  createDirectory as createDir, updateDirectory as updateDir, deleteDirectory as deleteDir,
  fetchDirectoryCollections, fetchDirectoryProjects, fetchDirectoryEntities,
} from '../services/frontend-queries'
import type {
  DirectorySummary, CollectionListItem,
  DirectoryCollection, DirectoryProject, DirectoryEntity,
} from '../types/frontend'

interface DirectoryStore {
  // Home data
  directories: DirectorySummary[]
  allCollections: CollectionListItem[]
  isLoading: boolean
  error: string | null

  // Directory detail
  directoryDetail: {
    name: string
    description: string | null
    collections: DirectoryCollection[]
    projects: DirectoryProject[]
    entities: DirectoryEntity[]
  } | null
  isLoadingDetail: boolean

  // Actions
  loadDirectories: () => Promise<void>
  loadAllCollections: () => Promise<void>
  loadDirectoryDetail: (name: string) => Promise<void>
  createDirectory: (name: string, description: string) => Promise<void>
  updateDirectory: (oldName: string, newName: string, desc: string) => Promise<void>
  deleteDirectory: (name: string) => Promise<boolean>
}

let directoriesVersion = 0
let collectionsVersion = 0
let detailVersion = 0

export const useDirectoryStore = create<DirectoryStore>((set, get) => ({
  directories: [],
  allCollections: [],
  isLoading: false,
  error: null,
  directoryDetail: null,
  isLoadingDetail: false,

  loadDirectories: async () => {
    const version = ++directoriesVersion
    set({ isLoading: true, error: null })
    try {
      const directories = await fetchAllDirectories()
      if (version === directoriesVersion) set({ directories, isLoading: false })
    } catch (err) {
      if (version === directoriesVersion) set({ error: describeDataError(err), isLoading: false })
    }
  },

  loadAllCollections: async () => {
    const version = ++collectionsVersion
    try {
      const allCollections = await fetchAllCollections()
      if (version === collectionsVersion) set({ allCollections })
    } catch (err) {
      if (version === collectionsVersion) set({ error: describeDataError(err) })
    }
  },

  loadDirectoryDetail: async (name: string) => {
    const version = ++detailVersion
    set({ isLoadingDetail: true, error: null, directoryDetail: null })
    try {
      const [collections, projects, entities] = await Promise.all([
        fetchDirectoryCollections(name),
        fetchDirectoryProjects(name),
        fetchDirectoryEntities(name),
      ])
      if (version !== detailVersion) return
      const dir = get().directories.find(d => d.name === name)
      set({
        directoryDetail: {
          name,
          description: dir?.description ?? null,
          collections,
          projects,
          entities,
        },
        isLoadingDetail: false,
      })
    } catch (err) {
      if (version === detailVersion) set({ error: describeDataError(err), isLoadingDetail: false })
    }
  },

  createDirectory: async (name: string, description: string) => {
    await createDir(name, description)
    await get().loadDirectories()
  },

  updateDirectory: async (oldName: string, newName: string, desc: string) => {
    await updateDir(oldName, newName, desc)
    await get().loadDirectories()
  },

  deleteDirectory: async (name: string) => {
    const deleted = await deleteDir(name)
    if (deleted) {
      await get().loadDirectories()
    }
    return deleted
  },
}))
