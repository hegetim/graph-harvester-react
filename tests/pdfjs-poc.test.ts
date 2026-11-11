// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises'
import * as mupdf from 'mupdf'
import { getDocument, OPS, Util, version } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, PDFOperatorList } from 'pdfjs-dist/types/src/display/api'
import { expect, test, vi } from 'vitest'
import { get_paths_from_page } from '../lib/harvester/mupdf-adapter'
import { pdfFixture, pdfObjects } from './pdf-fixture'
import { decodePath, operatorNames } from './pdfjs-probe'

async function withDocument(data: Uint8Array, inspect: (doc: PDFDocumentProxy) => Promise<void>) {
  const task = getDocument({ data, stopAtErrors: true, useSystemFonts: false })
  try {
    await inspect(await task.promise)
  } finally {
    await task.destroy()
  }
}

function entries(list: PDFOperatorList) {
  return list.fnArray.map((code, index) => ({ code, name: operatorNames[code]!, args: list.argsArray[index] }))
}

function histogram(names: string[]) {
  return Object.fromEntries([...new Set(names)].sort().map(name => [name, names.filter(n => n === name).length]))
}

function paths(list: PDFOperatorList) {
  return entries(list).filter(op => op.code === OPS.constructPath).map(op => decodePath(op.args))
}

test('the operator representation is pinned to the investigated PDF.js release', () => {
  expect(version).toBe('6.5.438')
})

test.each(['plain.pdf', 'multi.pdf', 'single_page.pdf', 'multi_page.pdf', 'transforms.pdf', 'exotic.pdf'])(
  'PDF.js exposes the vector drawings in %s', async (fixture) => {
    const bytes = new Uint8Array(await readFile(new URL(`./assets/${fixture}`, import.meta.url)))
    const reference = mupdf.PDFDocument.openDocument(bytes)
    try {
      // Pass an owned copy: PDF.js workers may transfer/detach the input buffer.
      await withDocument(bytes.slice(), async (doc) => {
        expect(doc.numPages).toBe(reference.countPages())
        const summary = []
        for (let number = 1; number <= doc.numPages; number++) {
          const page = await doc.getPage(number)
          const list = await page.getOperatorList()
          const decoded = paths(list)
          const referencePage = reference.loadPage(number - 1)
          let referencePaints: string[]
          try {
            referencePaints = get_paths_from_page(referencePage).map(path => path.type)
          } finally {
            referencePage.destroy()
          }
          const paints = decoded.flatMap(path => {
            switch (path.paint) {
              case 'stroke': case 'closeStroke': return ['stroke']
              case 'fill': case 'eoFill': return ['fill']
              case 'fillStroke': case 'eoFillStroke':
              case 'closeFillStroke': case 'closeEOFillStroke': return ['fill', 'stroke']
              case 'endPath': return [] // clipping-only paths aren't drawings
              default: throw new Error(`Unmapped paint operation ${path.paint}`)
            }
          })
          expect(histogram(paints)).toEqual(histogram(referencePaints))
          summary.push({
            page: number,
            view: page.view,
            rotation: page.rotate,
            viewportTransform: page.getViewport({ scale: 1 }).transform,
            operators: histogram(entries(list).map(op => op.name)),
            paints: histogram(paints),
            pathCommands: histogram(decoded.flatMap(path => path.commands.map(command => command.command))),
          })
          page.cleanup()
        }
        expect(summary).toMatchSnapshot()
      })
    } finally {
      reference.destroy()
    }
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('exotic.pdf retains its additional graphics features', async () => {
  const data = new Uint8Array(await readFile(new URL('./assets/exotic.pdf', import.meta.url)))
  await withDocument(data, async (doc) => {
    expect(doc.numPages).toBe(3)
    const pageOne = await (await doc.getPage(1)).getOperatorList()
    expect(entries(pageOne)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'setFillRGBColor', args: ['#ff7f00'] }),
      expect.objectContaining({ name: 'setStrokeRGBColor', args: ['#1f78b4'] }),
      expect.objectContaining({ name: 'setGState', args: [[['CA', 0.3], ['ca', 0.3]]] }),
      expect.objectContaining({ name: 'setDash', args: [[4, 2, 1, 2], 0] }),
      expect.objectContaining({ name: 'setDash', args: [[1, 1], 0] }),
    ]))
    expect(paths(pageOne).map(path => path.paint)).toContain('fill')

    const pageTwo = await (await doc.getPage(2)).getOperatorList()
    expect(entries(pageTwo)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'setLineCap', args: [2] }), // square
      expect.objectContaining({ name: 'eoClip' }),
    ]))
    expect(paths(pageTwo).map(path => path.paint)).toContain('endPath')

    const pageThree = await (await doc.getPage(3)).getOperatorList()
    expect(entries(pageThree)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'setLineJoin', args: [0] }), // miter
      expect.objectContaining({ name: 'setFillRGBColor', args: ['#6a3d9a'] }),
      expect.objectContaining({ name: 'paintImageXObject' }),
    ]))
    expect(paths(pageThree).map(path => path.paint)).toContain('eoFillStroke')
  })
})

test('paths retain cubic control points, transforms, colors and stroke properties', async () => {
  const stream = 'q 2 0 0 3 10 20 cm 2 w 1 J 2 j 7 M [2 3] 1 d ' +
    '0.2 0.3 0.4 rg 1 0 0 RG 0 0 m 10 0 l 10 10 20 10 20 20 c h B* Q'
  await withDocument(pdfFixture([stream]), async (doc) => {
    const page = await doc.getPage(1)
    const list = await page.getOperatorList()
    expect(entries(list).map(op => [op.name, op.args]).filter(([name]) => name !== 'constructPath'))
      .toEqual([
        ['save', null], ['transform', [2, 0, 0, 3, 10, 20]],
        ['setLineWidth', [2]], ['setLineCap', [1]], ['setLineJoin', [2]],
        ['setMiterLimit', [7]], ['setDash', [[2, 3], 1]],
        ['setFillRGBColor', ['#334c66']], ['setStrokeRGBColor', ['#ff0000']],
        ['restore', null],
      ])
    expect(paths(list)).toEqual([{
      paint: 'eoFillStroke', bounds: [0, 0, 20, 20], commands: [
        { command: 'moveTo', coordinates: [0, 0] },
        { command: 'lineTo', coordinates: [10, 0] },
        { command: 'curveTo', coordinates: [10, 10, 20, 10, 20, 20] },
        { command: 'closePath', coordinates: [] },
      ],
    }])
    // The path remains in local coordinates. Apply graphics-state CTM first,
    // then the viewport transform to obtain top-left, Y-down coordinates.
    const point = [20, 20]
    Util.applyTransform(point, [2, 0, 0, 3, 10, 20])
    Util.applyTransform(point, page.getViewport({ scale: 1 }).transform)
    expect(point).toEqual([50, 320])
  })
})

test('grayscale and CMYK colors are normalized to RGB strings', async () => {
  await withDocument(pdfFixture([
    '0.5 g 0 0 20 20 re f 0 1 1 0 k 30 0 20 20 re f 0 G 0 0 5 5 re S',
  ]), async (doc) => {
    const list = await (await doc.getPage(1)).getOperatorList()
    expect(entries(list).filter(op => op.name.endsWith('RGBColor')).map(op => [op.name, op.args]))
      .toEqual([
        ['setFillRGBColor', ['#808080']],
        ['setFillRGBColor', ['#ff2e17']],
        ['setStrokeRGBColor', ['#000000']],
      ])
  })
})

test('nested save/restore preserves the graphics-state boundaries around drawings', async () => {
  await withDocument(pdfFixture([
    'q 1 0 0 1 10 20 cm 2 w q 2 0 0 2 0 0 cm 4 w 0 0 20 20 re S Q 0 0 30 30 re S Q',
  ]), async (doc) => {
    const list = await (await doc.getPage(1)).getOperatorList()
    expect(entries(list).map(op => op.name)).toEqual([
      'save', 'transform', 'setLineWidth', 'save', 'transform', 'setLineWidth',
      'constructPath', 'restore', 'constructPath', 'restore',
    ])
    expect(paths(list).map(path => path.bounds)).toEqual([[0, 0, 20, 20], [0, 0, 30, 30]])
  })
})

test('PDF shorthand curves are expanded into explicit cubic control points', async () => {
  await withDocument(pdfFixture(['0 0 m 10 10 20 20 v 30 30 40 40 y S']), async (doc) => {
    const list = await (await doc.getPage(1)).getOperatorList()
    expect(paths(list)[0]!.commands).toEqual([
      { command: 'moveTo', coordinates: [0, 0] },
      { command: 'curveTo', coordinates: [0, 0, 10, 10, 20, 20] },
      { command: 'curveTo', coordinates: [30, 30, 40, 40, 40, 40] },
    ])
  })
})

test.each([
  ['f', 'fill'], ['f*', 'eoFill'], ['S', 'stroke'], ['s', 'closeStroke'],
  ['B', 'fillStroke'], ['B*', 'eoFillStroke'], ['b', 'closeFillStroke'], ['b*', 'closeEOFillStroke'],
])('PDF painting operator %s retains its semantics', async (pdfOperator, expected) => {
  await withDocument(pdfFixture([`0 0 m 100 0 l 100 100 l h ${pdfOperator}`]), async (doc) => {
    expect(paths(await (await doc.getPage(1)).getOperatorList())[0]!.paint).toBe(expected)
  })
})

test.each([['W', OPS.clip], ['W*', OPS.eoClip]])('clipping operator %s is exposed separately', async (clip, code) => {
  await withDocument(pdfFixture([`0 0 100 100 re ${clip} n 10 10 80 80 re f`]), async (doc) => {
    const list = await (await doc.getPage(1)).getOperatorList()
    expect(list.fnArray[0]).toBe(code)
    expect(paths(list).map(path => path.paint)).toEqual(['endPath', 'fill'])
  })
})

function streamObject(stream: string, dictionary = '') {
  return `<< ${dictionary} /Length ${stream.length} >>\nstream\n${stream}\nendstream`
}

test('nested Form XObjects expose their matrices, bounding boxes and opacity', async () => {
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] ' +
      '/Resources << /XObject << /Outer 5 0 R >> >> /Contents 4 0 R >>',
    streamObject('q 1 0 0 1 10 20 cm /Outer Do Q'),
    streamObject('/Inner Do', '/Type /XObject /Subtype /Form /BBox [0 0 100 100] ' +
      '/Matrix [2 0 0 2 0 0] /Resources << /XObject << /Inner 6 0 R >> >>'),
    streamObject('/Alpha gs 0 0 40 40 re B', '/Type /XObject /Subtype /Form /BBox [0 0 50 50] ' +
      '/Matrix [1 0 0 1 5 6] /Resources << /ExtGState << /Alpha 7 0 R >> >>'),
    '<< /Type /ExtGState /ca 0.4 /CA 0.7 >>',
  ])
  await withDocument(data, async (doc) => {
    const list = await (await doc.getPage(1)).getOperatorList()
    const ops = entries(list)
    expect(ops.filter(op => op.code === OPS.paintFormXObjectBegin)
      .map(op => (op.args as Float32Array[]).map(value => Array.from(value))))
      .toEqual([[[2, 0, 0, 2, 0, 0], [0, 0, 100, 100]], [[1, 0, 0, 1, 5, 6], [0, 0, 50, 50]]])
    expect(ops.filter(op => op.code === OPS.paintFormXObjectEnd)).toHaveLength(2)
    expect(ops.find(op => op.code === OPS.transform)!.args).toEqual([1, 0, 0, 1, 10, 20])
    const state = ops.find(op => op.code === OPS.setGState)!.args[0]
    expect(state).toEqual(expect.arrayContaining([['ca', 0.4], ['CA', 0.7]]))
    expect(paths(list)[0]!.paint).toBe('fillStroke')
  })
})

test('page rotation and a nonzero crop origin are exposed by the viewport', async () => {
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /CropBox [10 20 210 320] ' +
      '/Rotate 90 /Resources << >> /Contents 4 0 R >>',
    streamObject('10 20 100 100 re f'),
  ])
  await withDocument(data, async (doc) => {
    const page = await doc.getPage(1)
    expect(page.view).toEqual([10, 20, 210, 320])
    expect(page.rotate).toBe(90)
    const viewport = page.getViewport({ scale: 1 })
    expect([viewport.width, viewport.height]).toEqual([300, 200])
    expect(viewport.convertToViewportPoint(10, 20)).toEqual([0, 0])
    expect(paths(await page.getOperatorList())[0]!.bounds).toEqual([10, 20, 110, 120])
  })
})

test('malformed input fails instead of silently returning an empty document', async () => {
  const task = getDocument({ data: new Uint8Array([1, 2, 3]), stopAtErrors: true })
  const warning = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await expect(task.promise).rejects.toThrow()
  } finally {
    await task.destroy()
    warning.mockRestore()
  }
})
