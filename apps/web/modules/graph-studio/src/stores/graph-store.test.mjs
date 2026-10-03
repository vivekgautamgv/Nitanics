import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { toGraphData } from '../services/transforms'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const project = uniqueId => ({ uniqueId, name: uniqueId, summary: '', domain: '', subdomain: '', baseTags: [], htmlPath: '' })
const entity = entityId => ({ entityId, name: entityId, category: 'concept', definition: '', aliases: [], pageRank: 1, betweenness: 0, degree: 1, projectCount: 1 })
const row = (id, targetId = null, projectId = 'p1') => ({
  entity: entity(id), targetId,
  rel: targetId ? { relType: 'SUPPORTS', causalClassification: 'INFLUENCES', description: projectId, evidence: projectId, evidenceStrength: 'established', magnitude: 'marginal', year: null, projectId } : null,
})
const membership = (entityId, projectUniqueId) => ({ entityId, projectUniqueId, role: '' })
const detail = name => ({ name, category: 'concept', definition: '', aliases: [], pageRank: 1, betweenness: 0, degree: 1, projectCount: 1, projects: [], relationships: [], chainLinks: [], similarEntities: [] })

let collectionRows, projectRows, bridgeRows, projects, memberships, pendingDetails
mock.module('../services/queries', () => ({
  fetchCollectionGraph: async name => collectionRows.get(name) ?? [],
  fetchProjectGraph: async id => projectRows.get(id) ?? [],
  fetchBridgeGraph: async name => bridgeRows.get(name) ?? [],
  fetchCollectionProjects: async () => projects,
  fetchBridgeEntities: async () => [],
  fetchMentionedInEdges: async () => memberships,
  fetchEntityDetail: async name => pendingDetails.get(name)?.promise ?? detail(name),
}))
const { useGraphStore } = await import('./graph-store')
const { useSelectionStore } = await import('./selection-store')
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }

beforeEach(() => {
  collectionRows = new Map([['test', [row('A', 'B'), row('B')]]])
  projectRows = new Map([['p1', [row('A', 'B'), row('B')]]])
  bridgeRows = new Map()
  projects = [project('p1'), project('p2')]
  memberships = [membership('A', 'p1'), membership('B', 'p1'), membership('A', 'p2')]
  pendingDetails = new Map()
  useGraphStore.setState({ collection: '', graphMode: 'collection', selectedProjectId: null, isLoading: false, allNodes: [], allLinks: [], projects: [], error: null })
  useSelectionStore.getState().clearAll()
})

describe('graph scope and filters', () => {
  test('a newer scope request wins even when the previous load finishes later', async () => {
    const old = deferred()
    collectionRows.set('old', old.promise)
    const first = useGraphStore.getState().loadCollection('old')
    await useGraphStore.getState().loadCollection('test')
    old.resolve([row('Stale')])
    await first
    expect(useGraphStore.getState().collection).toBe('test')
    expect(useGraphStore.getState().allNodes.map(node => node.name)).not.toContain('Stale')
    expect(useGraphStore.getState().error).toBeNull()
  })

  test('a superseded request cannot surface its error over the current graph', async () => {
    const old = deferred()
    collectionRows.set('old', old.promise)
    const first = useGraphStore.getState().loadCollection('old')
    await useGraphStore.getState().loadCollection('test')
    old.reject(new Error('superseded failure'))
    await first
    expect(useGraphStore.getState().error).toBeNull()
    expect(useGraphStore.getState().isLoading).toBe(false)
  })

  test('document scope excludes unrelated projects and memberships', async () => {
    await useGraphStore.getState().loadProjectGraph('p1', 'test')
    const graph = useGraphStore.getState()
    expect(graph.allNodes.filter(node => node.__type === 'project').map(node => node.id)).toEqual(['p1'])
    expect(graph.allNodes.find(node => node.id === 'A').__projects).toEqual(['p1'])
    expect(graph.allLinks.every(link => link.projectId === 'p1')).toBe(true)
  })

  test('empty bridge scope does not render unrelated project nodes', async () => {
    await useGraphStore.getState().loadBridgeGraph('test')
    expect(useGraphStore.getState().allNodes).toEqual([])
    expect(useGraphStore.getState().allLinks).toEqual([])
  })

  test('returning to collection scope restores default mode and filters', async () => {
    await useGraphStore.getState().loadProjectGraph('p1', 'test')
    useGraphStore.getState().setBandwidthRange([90, 100])
    await useGraphStore.getState().loadBridgeGraph('test')
    await useGraphStore.getState().loadCollection('test')
    expect(useGraphStore.getState().graphMode).toBe('collection')
    expect(useGraphStore.getState().selectedProjectId).toBeNull()
    expect(useGraphStore.getState().bandwidthRange).toEqual([0, 100])
    expect(useGraphStore.getState().bridgeFilter.has('none')).toBe(true)
  })

  test('hiding all projects hides every entity, project and link', async () => {
    await useGraphStore.getState().loadCollection('test')
    useGraphStore.getState().deselectAllProjects()
    expect(useGraphStore.getState().filteredNodes).toEqual([])
    expect(useGraphStore.getState().filteredLinks).toEqual([])
    useGraphStore.getState().selectAllProjects()
    expect(useGraphStore.getState().filteredNodes.length).toBe(4)
  })

  test('the same relationship from separate projects retains separate evidence', () => {
    const graph = toGraphData([row('A', 'B', 'p1'), row('A', 'B', 'p2'), row('B')], projects, [], memberships)
    expect(graph.links.filter(link => link.relType === 'SUPPORTS').map(link => link.evidence)).toEqual(['p1', 'p2'])
  })

  test('importance percentiles preserve ties when ranking large graph data', () => {
    const stronger = row('C')
    stronger.entity.pageRank = 2
    const graph = toGraphData([row('A'), row('B'), stronger], [], [])
    expect(graph.nodes.map(node => node.__compositeImportance)).toEqual([67, 67, 100])
  })
})

describe('entity detail requests', () => {
  test('an old selection cannot finish the current selection loading state', async () => {
    await useGraphStore.getState().loadCollection('test')
    const first = deferred(), second = deferred()
    pendingDetails.set('A', first)
    pendingDetails.set('B', second)
    const nodes = useGraphStore.getState().allNodes
    useSelectionStore.getState().selectNode(nodes.find(node => node.name === 'A'))
    useSelectionStore.getState().selectNode(nodes.find(node => node.name === 'B'))
    first.resolve(detail('A'))
    await flush()
    expect(useSelectionStore.getState().isLoadingDetail).toBe(true)
    expect(useSelectionStore.getState().selectedNode.name).toBe('B')
    second.resolve(detail('B'))
    await flush()
    expect(useSelectionStore.getState().isLoadingDetail).toBe(false)
  })

  test('closing the inspector discards pending detail and cache writes', async () => {
    await useGraphStore.getState().loadCollection('test')
    const pending = deferred()
    pendingDetails.set('A', pending)
    useSelectionStore.getState().selectNode(useGraphStore.getState().allNodes.find(node => node.name === 'A'))
    useSelectionStore.getState().clearAll()
    pending.resolve(detail('A'))
    await flush()
    expect(useSelectionStore.getState().selectedNode).toBeNull()
    expect(useSelectionStore.getState().entityDetails.has('A')).toBe(false)
  })

  test('unlocking cancels pending exploration cards', async () => {
    await useGraphStore.getState().loadCollection('test')
    const nodes = useGraphStore.getState().allNodes
    useSelectionStore.getState().selectNode(nodes.find(node => node.name === 'A'))
    await flush()
    useSelectionStore.getState().lockNode()
    const pending = deferred()
    pendingDetails.set('B', pending)
    useSelectionStore.getState().selectNode(nodes.find(node => node.name === 'B'))
    useSelectionStore.getState().unlockNode()
    pending.resolve(detail('B'))
    await flush()
    expect(useSelectionStore.getState().explorationStack).toEqual([])
    expect(useSelectionStore.getState().selectedNode.name).toBe('A')
  })
})
