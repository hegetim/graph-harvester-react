// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import * as mupdf from 'mupdf'
import { expect, test } from 'vitest'
import { get_paths_from_page, renderDrawing } from '../lib/harvester/mupdf-adapter'
import { break_path_into_strokes, transform_point } from '../lib/harvester/geometry_utils'
import { Drawing } from '../lib/harvester/wrappers'
import { pdfFixture } from './pdf-fixture'

test('MuPDF adapter copies path commands, graphics state, and colors into plain values', () => {
  const doc = mupdf.PDFDocument.openDocument(pdfFixture([
    'q 2 0 0 3 10 20 cm 2 w 1 J 2 j 7 M [2 3] 1 d 1 0 0 RG ' +
    '0 0 m 10 0 l 10 10 20 10 20 20 c h S Q',
  ]))
  const page = doc.loadPage(0)
  try {
    const paths = get_paths_from_page(page)
    expect(paths).toHaveLength(1)
    const path = paths[0]!
    expect(path.type).toBe('stroke')
    expect(path.colorSpace).toBe('RGB')
    expect(path.color).toEqual([1, 0, 0])
    expect(path.stroke).toEqual({
      lineWidth: 2, lineCap: 1, lineJoin: 2, miterLimit: 7,
      dashPhase: 1, dashes: [2, 3],
    })
    expect(path.path).toEqual([
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 10, y: 0 },
      { type: 'curveTo', x1: 10, y1: 10, x2: 20, y2: 10, x3: 20, y3: 20 },
      { type: 'closePath' },
    ])
    expect(JSON.parse(JSON.stringify(path)).path).toEqual(path.path)
    const segments = break_path_into_strokes(path, 1).strokes
    expect(segments.map(segment => segment.type)).toEqual(['line', 'curve', 'line'])
    expect(segments[0]!.start).toEqual(transform_point(path.ctm, 0, 0))
    expect(segments[1]!.end).toEqual(transform_point(path.ctm, 20, 20))
    // A cloned style cannot mutate the extracted one.
    const copy = structuredClone(path.stroke!)
    copy.dashes[0] = 99
    expect(path.stroke!.dashes).toEqual([2, 3])
  } finally {
    page.destroy()
    doc.destroy()
  }
})

test('preview retains borrowed native paths after page and document cleanup', () => {
  const doc = mupdf.PDFDocument.openDocument(pdfFixture(['0 g 0 0 100 100 re f']))
  const page = doc.loadPage(0)
  const paths = get_paths_from_page(page)
  page.destroy()
  doc.destroy()
  const png = renderDrawing(new Drawing(paths), 1)
  expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const image = new mupdf.Image(png)
  const pixmap = image.toPixmap()
  try {
    expect(Array.from(pixmap.getPixels().subarray(0, 3))).toEqual([0, 0, 0])
  } finally {
    pixmap.destroy()
    image.destroy()
  }
})
