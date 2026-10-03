import { describe, expect, test } from 'bun:test'
import { findGraphPath } from './graph-paths'

const node = (id, type = 'entity') => ({ id, name: id, __type: type })
const edge = (source, target, relType = 'INFLUENCES') => ({ source, target, relType })

describe('paths through the loaded graph', () => {
  test('finds the shortest undirected path and preserves semantic relationship types', () => {
    const nodes = ['A', 'B', 'C', 'D'].map(id => node(id))
    const links = [edge('A', 'B', 'CAUSES'), edge('B', 'C', 'SUPPORTS'), edge('A', 'D'), edge('D', 'B')]
    expect(findGraphPath(nodes, links, 'C', 'A')).toEqual({
      from: 'C', to: 'A', entities: ['C', 'B', 'A'], relTypes: ['SUPPORTS', 'CAUSES'], hops: 2,
    })
  })

  test('document membership is optional and document endpoints work when enabled', () => {
    const nodes = [node('A'), node('B'), node('Document', 'project')]
    const links = [edge('A', 'Document', 'MENTIONED_IN'), edge('B', 'Document', 'MENTIONED_IN')]
    expect(findGraphPath(nodes, links, 'A', 'B')).toBeNull()
    expect(findGraphPath(nodes, links, 'A', 'B', true)?.entities).toEqual(['A', 'Document', 'B'])
    expect(findGraphPath(nodes, links, 'A', 'Document', true)?.hops).toBe(1)
  })

  test('cannot traverse missing nodes or nodes outside the loaded scope', () => {
    const nodes = [node('A'), node('B')]
    expect(findGraphPath(nodes, [edge('A', 'Outside'), edge('Outside', 'B')], 'A', 'B')).toBeNull()
    expect(findGraphPath(nodes, [], 'A', 'Unknown')).toBeNull()
  })

  test('handles force-graph endpoints mutated into node objects', () => {
    const nodes = [node('A'), node('B')]
    expect(findGraphPath(nodes, [edge(nodes[0], nodes[1], 'DEPENDS_ON')], 'A', 'B')?.relTypes).toEqual(['DEPENDS_ON'])
  })

  test('includes an eight-hop path but stops before nine hops', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => node(String(i)))
    const links = nodes.slice(1).map((_, i) => edge(String(i), String(i + 1)))
    expect(findGraphPath(nodes, links, '0', '8')?.hops).toBe(8)
    expect(findGraphPath(nodes, links, '0', '9')).toBeNull()
  })
})
