import * as mupdf from 'mupdf'
import { expect, test } from 'vitest'
import { stroke_similarity } from '../lib/harvester/geometry_utils'
import { strokeFromMuPDF } from '../lib/harvester/mupdf-adapter'
import type { StrokeStyle } from '../lib/harvester/drawing-model'
import { pdfFixture } from './pdf-fixture'

// MuPDF's StrokeState constructor does not preserve dashes; extract a PDF style.
function strokeState(data: mupdf.StrokeStateData): StrokeStyle {
  const cap = mupdf.StrokeState.LINE_CAP.indexOf(data.lineCap)
  const join = mupdf.StrokeState.LINE_JOIN.indexOf(data.lineJoin)
  const doc = mupdf.PDFDocument.openDocument(pdfFixture([
    `${data.lineWidth} w ${cap} J ${join} j ${data.miterLimit} M ` +
    `[${(data.dashes ?? []).join(' ')}] ${data.dashPhase ?? 0} d 0 0 m 10 10 l S`,
  ]))
  const page = doc.loadPage(0)
  const list = page.toDisplayList()
  let result: StrokeStyle | undefined
  const device = new mupdf.Device({ strokePath: (_path, stroke) => { result = strokeFromMuPDF(stroke) } })
  try {
    list.run(device, mupdf.Matrix.identity)
    device.close()
    if (!result) throw new Error('Fixture did not produce a stroke')
    expect(result.dashes).toEqual(data.dashes ?? [])
    return result
  } finally {
    device.destroy()
    list.destroy()
    page.destroy()
    doc.destroy()
  }
}

const base: mupdf.StrokeStateData = {
  lineCap: 'Butt', lineJoin: 'Miter', lineWidth: 1, miterLimit: 10,
  dashPhase: 0, dashes: [2, 3],
}

test('separate stroke states with equal values receive the maximum score', () => {
  expect(stroke_similarity(strokeState(base), strokeState({ ...base, dashes: [2, 3] }))).toBe(5)
})

test.each([
  { lineWidth: 2 }, { lineCap: 'Round' as const }, { lineJoin: 'Bevel' as const },
  { dashPhase: 1 }, { dashes: [2, 4] }, { dashes: [2, 3, 2, 3] },
])('a differing stroke property reduces the score: %j', (change) => {
  expect(stroke_similarity(strokeState(base), strokeState({ ...base, ...change }))).toBe(4)
})

test('completely different styles receive a zero score', () => {
  expect(stroke_similarity(strokeState(base), strokeState({
    lineCap: 'Round', lineJoin: 'Bevel', lineWidth: 2, miterLimit: 10,
    dashPhase: 1, dashes: [4, 5],
  }))).toBe(0)
})

test('solid strokes compare equally with omitted or empty dash arrays', () => {
  expect(stroke_similarity(strokeState({ ...base, dashes: undefined }), strokeState({ ...base, dashes: [] }))).toBe(5)
})
