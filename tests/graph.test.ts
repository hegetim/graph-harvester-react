import { expect, test, vi } from 'vitest'
import { Graph, Vertex } from '../lib/harvester/wrappers'

function triangle() {
  const graph = new Graph()
  for (const id of [3, 1, 2]) graph.putVertex(new Vertex(id, id * 10, 0))
  for (const [v1_id, v2_id] of [[1, 2], [2, 3], [3, 1]]) graph.putEdge({ v1_id, v2_id })
  return graph
}

test('adjacency is symmetric and sorted by vertex ID; graph6 encodes K3', () => {
  const graph = triangle()
  expect(graph.toAdjacencyMatrix()).toEqual([[0, 1, 1], [1, 0, 1], [1, 1, 0]])
  expect(graph.toGraph6()).toBe('Bw')
})

test('ignores duplicate edges, self-loops and nonexistent vertices', () => {
  const graph = triangle()
  graph.putEdge({ v1_id: 2, v2_id: 1 })
  graph.putEdge({ v1_id: 1, v2_id: 1 })
  graph.putEdge({ v1_id: 1, v2_id: 99 })
  expect(graph.edges).toHaveLength(3)
  expect(graph.putVertex(new Vertex(1, 0, 0))).toBe(-1)
})

test('empty graph has an empty adjacency matrix and valid graph6', () => {
  const graph = new Graph()
  expect(graph.toAdjacencyMatrix()).toEqual([])
  expect(graph.toGraph6()).toBe('?')
})

test('HoG lookup posts graph6 to the configured endpoint', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
    totalCandidates: 1,
    _embedded: { graphSearchModelList: [{ graphId: 42 }] },
  })))
  expect(await triangle().get_hog_id('/hog-api/enquiry')).toBe(42)
  expect(fetch).toHaveBeenCalledWith('/hog-api/enquiry', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('"canonicalForm":"Bw"'),
  }))
})

test('HoG distinguishes an absent graph from a failed lookup', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ totalCandidates: 0 })))
  expect(await triangle().get_hog_id()).toBeNull()
  vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }))
  await expect(triangle().get_hog_id()).rejects.toThrow('503')
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(triangle().get_hog_id()).rejects.toThrow('possibly CORS')
})
