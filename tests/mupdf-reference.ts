// Temporary regression oracle for the migration; never bundled or published.
import * as mupdf from 'mupdf'
import { detect_graphs_from_drawing } from '../lib/harvester/graph_detection'
import { group_paths_by_bb } from '../lib/harvester/pdf_extraction'
import { Graph, type DetectedGraph } from '../lib/harvester/wrappers'
import { get_paths_from_page, renderDrawing } from '../lib/harvester/mupdf-adapter'

export async function executeReference(file: ArrayBuffer | Uint8Array<ArrayBufferLike>): Promise<DetectedGraph[]> {
  const doc = mupdf.PDFDocument.openDocument(file)
  const results: DetectedGraph[] = []
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const page = doc.loadPage(i)
      try {
        const drawings = group_paths_by_bb(get_paths_from_page(page)).sort((a, b) => a.minX - b.minX)
        for (const drawing of drawings) {
          results.push(await Graph.toDetectedGraph(detect_graphs_from_drawing(drawing), drawing, false, undefined, renderDrawing))
        }
      } finally { page.destroy() }
    }
    return results
  } finally { doc.destroy() }
}
