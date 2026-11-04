/* Node-only debugging harness. Not imported by the browser package entry point. */

import * as mupdf from 'mupdf'
import * as fs from 'node:fs'
import { detect_graphs_from_drawing } from './graph_detection.js'
import * as pdf_extraction from './pdf_extraction.js'
import { execute_file } from './pipeline.js'
import { Graph } from './wrappers.js'
import { export_drawing, exportGraph } from './debug_exports.js'
import { get_paths_from_page } from './mupdf-adapter.js'

export function execute() {
  const logs: string[] = ['Logs of the most recent iteration\n']
  const file = fs.readFileSync('test_files/test.pdf')
  const doc = mupdf.PDFDocument.openDocument(file)
  const graphs: Graph[] = []

  for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex++) {
    const page = doc.loadPage(pageIndex)
    const paths = get_paths_from_page(page)
    const drawings = pdf_extraction.group_paths_by_bb(paths).sort((a, b) => a.minX - b.minX)
    drawings.forEach((drawing, drawingIndex) => {
      export_drawing(drawing, `test_files/test_d${drawingIndex + 1}`)
      const newGraphs = detect_graphs_from_drawing(drawing, logs)
      newGraphs.forEach((graph, graphIndex) => {
        graph.metadata.push(`Page ${pageIndex + 1}, Drawing ${drawingIndex + 1}, Nr ${graphIndex}`)
        exportGraph(graph, `test_files/Drawing ${drawingIndex + 1}, Nr ${graphIndex}`)
      })
      graphs.push(...newGraphs)
    })
  }

  fs.writeFileSync('test_files/log.txt', logs.join(''))
  return graphs
}

export { execute_file }
