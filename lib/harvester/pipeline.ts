/* SPDX-FileCopyrightText: 2026 Jonas Spies <jonas.spies@stud-mail.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import * as mupdf from 'mupdf'
import { detect_graphs_from_drawing } from './graph_detection.js'
import * as pdf_extraction from './pdf_extraction.js'
import { Graph, type DetectedGraph } from './wrappers.js'

/**
 * Run graph extraction on PDF bytes supplied by the caller.
 *
 * Filesystem and debugging concerns deliberately do not belong in this
 * browser-facing module; see node-debug.ts for the old command-line harness.
 */
export function execute_file(
  file: ArrayBuffer | Uint8Array<ArrayBufferLike>,
  params: { hog: boolean; logs?: string[] },
): DetectedGraph[] {
  const doc = mupdf.PDFDocument.openDocument(file)
  const detectedGraphs: DetectedGraph[] = []

  for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex++) {
    const page = doc.loadPage(pageIndex)
    const paths = pdf_extraction.get_paths_from_page(page)
    const drawings = pdf_extraction
      .group_paths_by_bb(paths)
      .sort((a, b) => a.minX - b.minX)

    for (let drawingIndex = 0; drawingIndex < drawings.length; drawingIndex++) {
      const drawing = drawings[drawingIndex]
      if (drawing === undefined) continue

      const graphs = detect_graphs_from_drawing(drawing, params.logs)
      graphs.forEach((graph, graphIndex) => {
        graph.metadata.push(
          `Page ${pageIndex + 1}, Drawing ${drawingIndex + 1}, Nr ${graphIndex}`,
        )
      })
      detectedGraphs.push(Graph.toDetectedGraph(graphs, drawing, params.hog))
    }
  }

  return detectedGraphs
}
