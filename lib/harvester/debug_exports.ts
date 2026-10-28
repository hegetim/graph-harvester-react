import * as fs from 'node:fs'
import type { Graph, Drawing } from './wrappers.js'

export function export_drawing(drawing: Drawing, name: string) {
  fs.writeFileSync(name + '.png', drawing.toPNG())
}

export function exportGraph(graph: Graph, name: string) {
  fs.writeFileSync(name + '.gv', graph.toString())
}

export function exportGraphAsAdjacency(graph: Graph, name: string) {
  const adjacency = graph.toAdjacencyMatrix()
  const text = adjacency.map(row => row.join(' ') + '\n').join('')
  fs.writeFileSync(name + '.txt', text)
}
