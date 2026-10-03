import type { GraphLink, GraphNode, PathResult } from '../types/graph'

/** Search only the loaded graph, with a bounded, undirected breadth-first traversal. */
export function findGraphPath(
  nodes: GraphNode[],
  links: GraphLink[],
  fromName: string,
  toName: string,
  includeDocuments = false,
  maxHops = 8,
): PathResult | null {
  const eligibleNodes = nodes.filter(node => includeDocuments || node.__type === 'entity')
  const byId = new Map(eligibleNodes.map(node => [node.id, node]))
  const from = eligibleNodes.find(node => node.name === fromName)
  const to = eligibleNodes.find(node => node.name === toName)
  if (!from || !to || from.id === to.id) return null

  const adjacency = new Map<string, Array<{ id: string; relType: string }>>()
  for (const link of links) {
    if (!includeDocuments && link.relType === 'MENTIONED_IN') continue
    const source = typeof link.source === 'string' ? link.source : link.source.id
    const target = typeof link.target === 'string' ? link.target : link.target.id
    if (!byId.has(source) || !byId.has(target)) continue
    const relType = link.relType || link.causalClassification || 'RELATED'
    const sourceNeighbors = adjacency.get(source) ?? []
    sourceNeighbors.push({ id: target, relType })
    adjacency.set(source, sourceNeighbors)
    const targetNeighbors = adjacency.get(target) ?? []
    targetNeighbors.push({ id: source, relType })
    adjacency.set(target, targetNeighbors)
  }

  const queue = [{ id: from.id, depth: 0 }]
  const visited = new Set([from.id])
  const previous = new Map<string, { id: string; relType: string }>()
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]!
    if (current.depth >= maxHops) continue
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (visited.has(neighbor.id)) continue
      visited.add(neighbor.id)
      previous.set(neighbor.id, { id: current.id, relType: neighbor.relType })
      if (neighbor.id === to.id) {
        const entities = [to.name]
        const relTypes: string[] = []
        let pathId = to.id
        while (pathId !== from.id) {
          const step = previous.get(pathId)!
          entities.push(byId.get(step.id)!.name)
          relTypes.push(step.relType)
          pathId = step.id
        }
        return { from: fromName, to: toName, entities: entities.reverse(), relTypes: relTypes.reverse(), hops: relTypes.length }
      }
      queue.push({ id: neighbor.id, depth: current.depth + 1 })
    }
  }
  return null
}
