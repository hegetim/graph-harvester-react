// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises'
import * as mupdf from 'mupdf'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, test } from 'vitest'
import { extractPDFJSPage } from '../lib/harvester/pdfjs-adapter'
import { get_paths_from_page } from '../lib/harvester/mupdf-adapter'
import { break_path_into_strokes, is_brighter_than } from '../lib/harvester/geometry_utils'
import { group_paths_by_bb } from '../lib/harvester/pdf_extraction'
import { detect_graphs_from_drawing } from '../lib/harvester/graph_detection'
import { patternFixture, pdfFixture, pdfObjects } from './pdf-fixture'

async function inspect(data: Uint8Array, fn: (page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>['promise']>['getPage']>>) => Promise<void>) {
  const task = getDocument({ data, stopAtErrors: true, useSystemFonts: false })
  try { await fn(await (await task.promise).getPage(1)) } finally { await task.destroy() }
}

test('extracts transformed paths, fill/stroke state, opacity and isolated state copies', async () => {
  const stream = 'q 2 0 0 3 10 20 cm 2 w 1 J 2 j 7 M [2 3] 1 d 1 0 0 rg 0 0 1 RG ' +
    '0 0 m 10 0 l 10 10 20 10 20 20 c h B* Q 0 0 10 10 re f'
  await inspect(pdfFixture([stream]), async page => {
    const { paths, warnings } = await extractPDFJSPage(page)
    expect(warnings).toEqual([])
    expect(paths.map(path => path.type)).toEqual(['fill', 'stroke', 'fill'])
    expect(paths[0]!.ctm).toEqual([2, 0, 0, -3, 10, 380])
    expect(paths[0]!.evenOdd).toBe(true)
    expect(paths[0]!.color).toEqual([1, 0, 0])
    expect(paths[1]!.color).toEqual([0, 0, 1])
    expect(paths[1]!.stroke).toEqual({ lineWidth: 2, lineCap: 1, lineJoin: 2, miterLimit: 7, dashPhase: 1, dashes: [2, 3] })
    expect(paths[2]!.ctm).toEqual([1, 0, 0, -1, 0, 400])
    expect(paths[2]!.color).toEqual([0, 0, 0])
    const segments = break_path_into_strokes(paths[1]!, 1).strokes
    expect(segments.map(segment => segment.type)).toEqual(['line', 'curve', 'line'])
    expect(segments[0]!.start).toEqual({ x: 10, y: 380 })
    expect(segments[1]!.end).toEqual({ x: 50, y: 320 })
  })
})

test.each(['S', 's', 'f', 'f*', 'B', 'B*', 'b', 'b*'])('empty %s path is a no-op, without affecting subsequent paths', async op => {
  await inspect(pdfFixture([`${op} 0 0 50 50 re f`]), async page => {
    const result = await extractPDFJSPage(page)
    expect(result.warnings).toEqual([])
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0]!.type).toBe('fill')
    expect(result.paths[0]!.getBounds()).toEqual([0, 350, 50, 400])
  })
})

test('pattern fills and strokes are retained with unknown color and graphics state is restored', async () => {
  await inspect(patternFixture(), async page => {
    const { paths, warnings } = await extractPDFJSPage(page)
    expect(warnings).toEqual(['Pattern colors are treated as unknown for graph detection'])
    expect(paths.map(path => path.type)).toEqual(['fill', 'stroke', 'fill', 'stroke', 'fill', 'fill'])
    expect(paths.map(path => path.colorSpace)).toEqual(['Pattern', 'Pattern', 'RGB', 'RGB', 'Pattern', 'RGB'])
    expect(paths.slice(0, 2).map(path => path.color)).toEqual([[], []])
    expect(is_brighter_than(paths[0]!, 0.8)).toBe(false)
    expect(is_brighter_than(paths[1]!, 0.8)).toBe(false)
    expect(paths[2]!.color).toEqual([1, 1, 1])
    expect(paths[3]!.color).toEqual([1, 1, 1])
    expect(paths[5]!.color).toEqual([0, 0, 0])
  })
})

test('ignores annotation appearances while extracting page content', async () => {
  const stream = (content: string, dictionary = '') =>
    `<< ${dictionary} /Length ${content.length} >>\nstream\n${content}\nendstream`
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R /Annots [5 0 R] >>',
    stream('0 g 20 20 80 80 re f'),
    '<< /Type /Annot /Subtype /Link /Rect [120 120 180 180] /F 4 /AP << /N 6 0 R >> >>',
    stream('1 0 0 rg 0 0 60 60 re f', '/Type /XObject /Subtype /Form /BBox [0 0 60 60] /Resources << >>'),
  ])
  await inspect(data, async page => {
    // Verify that the default list actually contains an annotation appearance.
    expect((await page.getOperatorList()).fnArray).toContain(OPS.beginAnnotation)
    const { paths } = await extractPDFJSPage(page)
    expect(paths).toHaveLength(1)
    expect(paths[0]!.getBounds()).toEqual([20, 100, 100, 180])
    expect(paths[0]!.color).toEqual([0, 0, 0])
  })
})

test('reports ignored clipping, while preserving both painted paths', async () => {
  await inspect(pdfFixture(['0 0 100 100 re W* n 0 0 50 50 re f 20 20 50 50 re S']), async page => {
    const result = await extractPDFJSPage(page)
    expect(result.warnings).toContain('Path clipping is ignored')
    expect(result.paths.map(p => p.type)).toEqual(['fill', 'stroke'])
  })
})

test('nested forms compose transforms and restore parent graphics state', async () => {
  const stream = (content: string, dictionary = '') =>
    `<< ${dictionary} /Length ${content.length} >>\nstream\n${content}\nendstream`
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /XObject << /Outer 5 0 R >> >> /Contents 4 0 R >>',
    stream('q 1 0 0 1 10 20 cm /Outer Do Q 0 0 20 20 re f'),
    stream('/Inner Do', '/Type /XObject /Subtype /Form /BBox [0 0 100 100] /Matrix [2 0 0 2 0 0] /Resources << /XObject << /Inner 6 0 R >> >>'),
    stream('/Alpha gs 0 0 40 40 re B', '/Type /XObject /Subtype /Form /BBox [0 0 50 50] /Matrix [1 0 0 1 5 6] /Resources << /ExtGState << /Alpha 7 0 R >> >>'),
    '<< /Type /ExtGState /ca 0.4 /CA 0.7 >>',
  ])
  await inspect(data, async page => {
    const { paths, warnings } = await extractPDFJSPage(page)
    expect(paths.map(path => path.type)).toEqual(['fill', 'stroke', 'fill'])
    expect(paths[0]!.ctm).toEqual([2, 0, 0, -2, 20, 368])
    expect(paths[0]!.alpha).toBe(0.4)
    expect(paths[1]!.alpha).toBe(0.7)
    expect(paths[2]!.ctm).toEqual([1, 0, 0, -1, 0, 400])
    expect(paths[2]!.alpha).toBe(1)
    expect(warnings).toContain('Form bounding-box clipping is ignored')
  })
})

test('exotic document retains opacity, dashes, colors and reports clipping', async () => {
  const data = new Uint8Array(await readFile(new URL('./assets/exotic.pdf', import.meta.url)))
  const task = getDocument({ data, stopAtErrors: true, useSystemFonts: false })
  try {
    const doc = await task.promise
    const first = await extractPDFJSPage(await doc.getPage(1))
    const translucent = first.paths.find(path => path.type === 'fill' && path.alpha === 0.3)!
    expect(translucent).toBeDefined()
    expect(translucent.evenOdd).toBe(false)
    expect(translucent.color).toEqual([1, 127 / 255, 0])
    expect(first.paths.filter(path => path.stroke?.dashes.length).map(path => path.stroke!.dashes))
      .toEqual([[4, 2, 1, 2], [1, 1]])
    const second = await extractPDFJSPage(await doc.getPage(2))
    expect(second.warnings).toContain('Path clipping is ignored')
    expect(second.paths.some(path => path.stroke?.lineCap === 2)).toBe(true)
    const third = await extractPDFJSPage(await doc.getPage(3))
    expect(third.paths.some(path => path.stroke?.lineJoin === 0)).toBe(true)
  } finally { await task.destroy() }
})

test('rotated cropped page coordinates use the PDF.js viewport', async () => {
  const stream = '10 20 100 100 re f'
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /CropBox [10 20 210 320] /Rotate 90 /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ])
  await inspect(data, async page => {
    const { paths } = await extractPDFJSPage(page)
    expect(paths[0]!.getBounds()).toEqual([0, 0, 100, 100])
  })
})

test.each(['plain.pdf', 'multi.pdf', 'single_page.pdf', 'multi_page.pdf', 'transforms.pdf', 'exotic.pdf'])(
  'extracts the same number of painted paths as MuPDF in %s', async fixture => {
    const bytes = new Uint8Array(await readFile(new URL(`./assets/${fixture}`, import.meta.url)))
    const task = getDocument({ data: bytes.slice(), stopAtErrors: true, useSystemFonts: false })
    const reference = mupdf.PDFDocument.openDocument(bytes)
    try {
      const doc = await task.promise
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1)
        const result = await extractPDFJSPage(page)
        const referencePage = reference.loadPage(i)
        try {
          const expected = get_paths_from_page(referencePage)
          const groups = (paths: typeof expected) => group_paths_by_bb(paths).sort((a, b) => a.minX - b.minX)
          const summarize = (paths: typeof expected) => groups(paths).map(drawing =>
            detect_graphs_from_drawing(drawing).map(graph => {
              const label = (vertex: typeof graph.vertices[number]) => `${Math.round(vertex.pos.x)}:${Math.round(vertex.pos.y)}`
              return {
                vertices: graph.vertices.map(label).sort(),
                edges: graph.edges.map(edge => [label(edge.v1), label(edge.v2)].sort().join('-')).sort(),
              }
            }))
          expect(summarize(result.paths), `page ${i + 1} graph topology`).toEqual(summarize(expected))
          expect(result.paths.map(p => p.type)).toEqual(expected.map(p => p.type))
          for (let index = 0; index < expected.length; index++) {
            const actualSegments = break_path_into_strokes(result.paths[index]!, 1).strokes
            const expectedSegments = break_path_into_strokes(expected[index]!, 1).strokes
            expect(actualSegments.map(s => s.type), `page ${i + 1} path ${index}`).toEqual(expectedSegments.map(s => s.type))
            for (let j = 0; j < expectedSegments.length; j++) {
              const actual = actualSegments[j]!
              const reference = expectedSegments[j]!
              const actualPoints = [actual.start, ...(actual.control_pts ?? []), actual.end]
              const referencePoints = [reference.start, ...(reference.control_pts ?? []), reference.end]
              for (let k = 0; k < referencePoints.length; k++) {
                expect(actualPoints[k]!.x, `page ${i + 1} path ${index} segment ${j}`).toBeCloseTo(referencePoints[k]!.x, 2)
                expect(actualPoints[k]!.y, `page ${i + 1} path ${index} segment ${j}`).toBeCloseTo(referencePoints[k]!.y, 2)
              }
            }
          }
        } finally { referencePage.destroy(); page.cleanup() }
      }
    } finally { await task.destroy(); reference.destroy() }
  },
)
