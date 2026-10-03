import { beforeEach, expect, mock, test } from 'bun:test'

const queries = {
  fetchAllDirectories: mock(async () => [] as any[]),
  fetchAllCollections: mock(async () => [] as any[]),
  fetchDirectoryCollections: mock(async (_name: string) => [] as any[]),
  fetchDirectoryProjects: mock(async (_name: string) => [] as any[]),
  fetchDirectoryEntities: mock(async (_name: string) => [] as any[]),
  createDirectory: mock(async () => {}), updateDirectory: mock(async () => {}), deleteDirectory: mock(async () => true),
  fetchCollectionSummary: mock(async (name: string) => ({ name, description: null }) as any),
  fetchCollectionProjects: mock(async () => []), fetchCollectionBridges: mock(async () => []),
  fetchCollectionTopEntities: mock(async () => []), fetchCollectionCategories: mock(async () => []),
  fetchCollectionChains: mock(async () => []), fetchProjectRecommendations: mock(async () => []),
  addProjectToCollection: mock(async () => {}), removeProjectFromCollection: mock(async () => false),
  updateCollectionDescription: mock(async () => {}),
  fetchProjectDetail: mock(async (uniqueId: string) => ({ uniqueId, name: uniqueId }) as any),
  fetchProjectEntities: mock(async () => []), fetchProjectRelationships: mock(async () => []),
  fetchRelatedProjects: mock(async () => []), fetchProjectChains: mock(async () => []), fetchProjectTimeline: mock(async () => []),
  fetchEntityProfile: mock(async (name: string) => ({ name }) as any),
}

mock.module('../src/services/frontend-queries', () => queries)
mock.module('../src/adapters/neo4j-service', () => ({ describeDataError: (error: unknown) => error instanceof Error ? error.message : String(error) }))
const { useProjectStore } = await import('../src/stores/project-store')
const { useEntityStore } = await import('../src/stores/entity-store')
const { useDirectoryStore } = await import('../src/stores/directory-store')
const { useCollectionStore } = await import('../src/stores/collection-store')

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  queries.fetchProjectDetail.mockImplementation(async uniqueId => ({ uniqueId, name: uniqueId }))
  queries.fetchEntityProfile.mockImplementation(async name => ({ name }))
  queries.fetchCollectionSummary.mockImplementation(async name => ({ name, description: null }))
  queries.fetchDirectoryCollections.mockImplementation(async () => [])
  queries.addProjectToCollection.mockImplementation(async () => {})
  queries.removeProjectFromCollection.mockImplementation(async () => false)
  queries.updateCollectionDescription.mockImplementation(async () => {})
})

test('a slow old project request cannot replace a newly selected project', async () => {
  const old = deferred<any>()
  queries.fetchProjectDetail.mockImplementation(async id => id === 'old' ? old.promise : { uniqueId: id })
  const first = useProjectStore.getState().loadProject('old')
  await useProjectStore.getState().loadProject('new')
  old.resolve({ uniqueId: 'old' })
  await first
  expect(useProjectStore.getState().detail?.uniqueId).toBe('new')
  expect(useProjectStore.getState().isLoading).toBe(false)
})

test('a late failure for a previous entity cannot erase the current profile', async () => {
  const old = deferred<any>()
  queries.fetchEntityProfile.mockImplementation(async name => name === 'old' ? old.promise : { name })
  const first = useEntityStore.getState().loadEntity('old')
  await useEntityStore.getState().loadEntity('new')
  old.reject(new Error('Old connection failed'))
  await first
  expect(useEntityStore.getState().profile?.name).toBe('new')
  expect(useEntityStore.getState().error).toBeNull()
})

test('directory details remain on the latest destination during racing requests', async () => {
  const old = deferred<any[]>()
  queries.fetchDirectoryCollections.mockImplementation(async name => name === 'old' ? old.promise : [])
  const first = useDirectoryStore.getState().loadDirectoryDetail('old')
  await useDirectoryStore.getState().loadDirectoryDetail('new')
  old.resolve([{ name: 'Old collection' }])
  await first
  expect(useDirectoryStore.getState().directoryDetail?.name).toBe('new')
})

test('collection loading rejects stale success and keeps the current collection', async () => {
  const old = deferred<any>()
  queries.fetchCollectionSummary.mockImplementation(async name => name === 'old' ? old.promise : { name, description: null })
  const first = useCollectionStore.getState().loadCollection('old')
  await useCollectionStore.getState().loadCollection('new')
  old.resolve({ name: 'old' })
  await first
  expect(useCollectionStore.getState().summary?.name).toBe('new')
})

test('a mutation finishing after navigation does not reload or edit a different collection', async () => {
  await useCollectionStore.getState().loadCollection('old')
  const add = deferred<void>()
  queries.addProjectToCollection.mockImplementation(async () => add.promise)
  const mutation = useCollectionStore.getState().addProject('project', 'old')
  await useCollectionStore.getState().loadCollection('new')
  add.resolve()
  await mutation
  expect(useCollectionStore.getState().summary?.name).toBe('new')
  await useCollectionStore.getState().updateDescription('old', 'Updated old description')
  expect(useCollectionStore.getState().summary?.description).toBeNull()
})

test('removing the final collection returns false and missing records show an actionable error', async () => {
  await useCollectionStore.getState().loadCollection('new')
  expect(await useCollectionStore.getState().removeProject('project', 'new')).toBe(false)
  expect(useCollectionStore.getState().summary?.name).toBe('new')
  queries.fetchProjectDetail.mockImplementation(async () => null)
  await useProjectStore.getState().loadProject('deleted')
  expect(useProjectStore.getState().detail).toBeNull()
  expect(useProjectStore.getState().error).toContain('could not be found')
})
