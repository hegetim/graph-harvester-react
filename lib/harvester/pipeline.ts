/* SPDX-FileCopyrightText: 2026 Jonas Spies <jonas.spies@stud-mail.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'
import { detect_graphs_from_drawing } from './graph_detection.js'
import { group_paths_by_bb } from './pdf_extraction.js'
import { isTrivialDrawing } from './drawing-filter.js'
import { Graph, type DetectedGraph } from './wrappers.js'
import { extractPDFJSPage } from './pdfjs-adapter.js'
import { renderPDFJSPreview, type PreviewOptions } from './pdfjs-preview.js'

interface PipelineOptions {
  hog: boolean
  hogEnquiryUrl?: string
  logs?: string[]
  /** Internal injection points for Node tests; not part of harvestFile's public API. */
  previewOptions?: PreviewOptions
  pdfOptions?: Pick<DocumentInitParameters, 'standardFontDataUrl' | 'cMapUrl' | 'wasmUrl' | 'iccUrl' | 'useSystemFonts' | 'useWorkerFetch'>
}

/** Extract graphs from PDF bytes without detaching or modifying caller-owned data. */
export async function execute_file(
  file: ArrayBuffer | Uint8Array<ArrayBufferLike>,
  params: PipelineOptions,
): Promise<DetectedGraph[]> {
  if (typeof window !== 'undefined') {
    // Asset emitted by Vite from the same pinned package as the main library.
    const { default: workerUrl } = await import('./pdfjs-worker.js')
    GlobalWorkerOptions.workerSrc = workerUrl
  }
  // PDF.js may transfer the supplied bytes to its worker.
  const bytes = file instanceof Uint8Array ? Uint8Array.from(file) : new Uint8Array(file.slice(0))
  const task = getDocument({ ...params.pdfOptions, data: bytes, stopAtErrors: true })
  try {
    const doc = await task.promise
    const detectedGraphs: DetectedGraph[] = []
    for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex + 1)
      try {
        const { paths, warnings } = await extractPDFJSPage(page)
        for (const warning of warnings) {
          const message = `PDF extraction, page ${pageIndex + 1}: ${warning}`
          if (params.logs) params.logs.push(message)
          else console.warn(message)
        }
        const drawings = group_paths_by_bb(paths)
          .filter(drawing => !isTrivialDrawing(drawing))
          .sort((a, b) => a.minX - b.minX)
        for (let drawingIndex = 0; drawingIndex < drawings.length; drawingIndex++) {
          const drawing = drawings[drawingIndex]!
          const graphs = detect_graphs_from_drawing(drawing, params.logs)
          graphs.forEach((graph, graphIndex) => {
            graph.metadata.push(`Page ${pageIndex + 1}, Drawing ${drawingIndex + 1}, Nr ${graphIndex}`)
          })
          detectedGraphs.push(await Graph.toDetectedGraph(graphs, drawing, params.hog, params.hogEnquiryUrl,
            (group, scale) => renderPDFJSPreview(page, group.getBounds(), { ...params.previewOptions, scale })))
        }
      } finally {
        page.cleanup()
      }
    }
    return detectedGraphs
  } finally {
    await task.destroy()
  }
}
