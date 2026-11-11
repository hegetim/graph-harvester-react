// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import * as mupdf from 'mupdf'
import { expect, test } from 'vitest'
import { Drawing } from '../lib/harvester/wrappers'
import { get_paths_from_page, pathFromMuPDF, renderDrawing } from '../lib/harvester/mupdf-adapter'
import { pdfFixture } from './pdf-fixture'

test.each([false, true])('extraction preserves evenOdd=%s', (evenOdd) => {
  const doc = mupdf.PDFDocument.openDocument(pdfFixture([
    `0 g 0 0 100 100 re 25 25 50 50 re ${evenOdd ? 'f*' : 'f'}`,
  ]))
  const page = doc.loadPage(0)
  try {
    const paths = get_paths_from_page(page)
    expect(paths).toHaveLength(1)
    expect(paths[0]!.evenOdd).toBe(evenOdd)
  } finally {
    page.destroy()
    doc.destroy()
  }
})

// Same-direction nested rectangles: the center is filled under nonzero winding,
// but is a hole under even-odd. Sample away from antialiased boundaries.
test.each([
  { rule: false, center: [0, 0, 0] },
  { rule: true, center: [255, 255, 255] },
  { rule: undefined, center: [0, 0, 0] },
])('preview uses fill rule $rule (undefined defaults to nonzero)', ({ rule, center }) => {
  const path = new mupdf.Path()
  path.rect(0, 0, 100, 100)
  path.rect(25, 25, 75, 75)
  const metadata = pathFromMuPDF(
    path, [0, 0, 100, 100], mupdf.Matrix.identity, 'fill',
    mupdf.ColorSpace.DeviceRGB, [0, 0, 0], 1, undefined, rule,
  )
  const image = new mupdf.Image(renderDrawing(new Drawing([metadata]), 1))
  const pixmap = image.toPixmap()
  try {
    expect(pixmap.getWidth()).toBe(100)
    expect(pixmap.getHeight()).toBe(100)
    const pixels = pixmap.getPixels()
    const sample = (x: number, y: number) => {
      const offset = y * pixmap.getStride() + x * pixmap.getNumberOfComponents()
      return Array.from(pixels.subarray(offset, offset + 3))
    }
    expect(sample(50, 50)).toEqual(center)
    expect(sample(10, 10)).toEqual([0, 0, 0])
  } finally {
    pixmap.destroy()
    image.destroy()
    path.destroy()
  }
})
