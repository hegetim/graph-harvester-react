// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import { expect, test } from 'vitest'
import { renderPDFJSPreview } from '../lib/harvester/pdfjs-preview'
import type { Rect } from '../lib/harvester/drawing-model'
import { extractPDFJSPage } from '../lib/harvester/pdfjs-adapter'
import { group_paths_by_bb } from '../lib/harvester/pdf_extraction'
import { detect_graphs_from_drawing } from '../lib/harvester/graph_detection'
import { Graph } from '../lib/harvester/wrappers'
import { pdfObjects } from './pdf-fixture'

const createTestCanvas = (width: number, height: number) => createCanvas(width, height) as unknown as HTMLCanvasElement

function stream(content: string, dict = '') {
  return `<< ${dict} /Length ${content.length} >>\nstream\n${content}\nendstream`
}

// Black vector line, text and a red raster image, with no external assets.
function mixedPage(rotation = 0) {
  const content = '0 0 0 RG 2 w 10 30 m 190 30 l S ' +
    'BT /F1 20 Tf 20 110 Td (TEST) Tj ET ' +
    'q 40 0 0 40 120 100 cm /Im1 Do Q'
  const image = 'FF0000'.repeat(16) + '>'
  return pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /CropBox [0 0 200 200] /Rotate ${rotation} ` +
      '/Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 4 0 R >>',
    stream(content),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream(image, '/Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode'),
  ])
}

async function withPage(data: Uint8Array, fn: (page: PDFPageProxy) => Promise<void>) {
  const task = getDocument({ data, stopAtErrors: true, useSystemFonts: false,
    standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)) })
  try { await fn(await (await task.promise).getPage(1)) } finally { await task.destroy() }
}

async function decode(base64: string) {
  const image = await loadImage(Buffer.from(base64, 'base64'))
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  return { image, ctx }
}

function pixel(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, x: number, y: number) {
  return Array.from(ctx.getImageData(x, y, 1, 1).data)
}

test('renders page content including text, vector paths and raster images in the crop', async () => {
  await withPage(mixedPage(), async page => {
    const result = await renderPDFJSPreview(page, [0, 50, 200, 180], { scale: 1, createCanvas: createTestCanvas })
    const { image, ctx } = await decode(result)
    expect([image.width, image.height]).toEqual([200, 130])
    expect(pixel(ctx, 140, 30)).toEqual([255, 0, 0, 255]) // image
    expect(pixel(ctx, 100, 120)).toEqual([0, 0, 0, 255]) // line
    let dark = 0
    for (let y = 20; y < 40; y++) for (let x = 20; x < 80; x++) {
      const p = pixel(ctx, x, y)
      if (p[0]! < 100 && p[1]! < 100 && p[2]! < 100) dark++
    }
    expect(dark).toBeGreaterThan(30) // text, not present in path-only previews
    expect(pixel(ctx, 5, 5)).toEqual([255, 255, 255, 255])
  })
})

test.each([0, 90, 180, 270])('crop matches a regular page render under page rotation %i', async rotation => {
  await withPage(mixedPage(rotation), async page => {
    const viewport = page.getViewport({ scale: 2 })
    const full = createCanvas(viewport.width, viewport.height)
    const fullContext = full.getContext('2d')
    await page.render({ canvas: null, canvasContext: fullContext as unknown as CanvasRenderingContext2D, viewport }).promise
    const bounds: Rect = [10, 20, 180, 160]
    const preview = await decode(await renderPDFJSPreview(page, bounds, { scale: 2, createCanvas: createTestCanvas }))
    expect([preview.image.width, preview.image.height]).toEqual([340, 280])
    // Compare decoded pixels, not PNG compression. Integer crop avoids interpolation.
    expect(preview.ctx.getImageData(0, 0, 340, 280).data)
      .toEqual(fullContext.getImageData(20, 40, 340, 280).data)
  })
})

test('includes visible annotation appearances', async () => {
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R /Annots [5 0 R] >>',
    stream(''),
    '<< /Type /Annot /Subtype /Square /Rect [20 20 60 60] /F 4 /AP << /N 6 0 R >> >>',
    stream('0 1 0 rg 0 0 40 40 re f', '/Type /XObject /Subtype /Form /BBox [0 0 40 40] /Resources << >>'),
  ])
  await withPage(data, async page => {
    const preview = await decode(await renderPDFJSPreview(page, [0, 0, 100, 100], { scale: 1, createCanvas: createTestCanvas }))
    expect(pixel(preview.ctx, 40, 60)).toEqual([0, 255, 0, 255])
  })
})

test('clips off-page content while keeping outside margins white', async () => {
  const data = pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /CropBox [10 10 90 90] /Resources << >> /Contents 4 0 R >>',
    stream('1 0 0 rg 0 0 100 100 re f'),
  ])
  await withPage(data, async page => {
    const preview = await decode(await renderPDFJSPreview(page, [-10, -10, 20, 20], { scale: 1, createCanvas: createTestCanvas }))
    expect(pixel(preview.ctx, 5, 15)).toEqual([255, 255, 255, 255])
    expect(pixel(preview.ctx, 15, 5)).toEqual([255, 255, 255, 255])
    expect(pixel(preview.ctx, 15, 15)).toEqual([255, 0, 0, 255])
  })
})

test('keeps out-of-page areas white and retains the requested crop dimensions', async () => {
  await withPage(mixedPage(), async page => {
    const preview = await decode(await renderPDFJSPreview(page, [-10, -20, 20, 20], { scale: 1, createCanvas: createTestCanvas }))
    expect([preview.image.width, preview.image.height]).toEqual([30, 40])
    expect(pixel(preview.ctx, 0, 0)).toEqual([255, 255, 255, 255])
    expect(pixel(preview.ctx, 15, 25)).toEqual([255, 255, 255, 255])
  })
})

test('rejects invalid and oversized crops before allocating canvas memory', async () => {
  await withPage(mixedPage(), async page => {
    const rejectCanvas = () => { throw new Error('unexpected allocation') }
    await expect(renderPDFJSPreview(page, [0, 0, 0, 10], { createCanvas: rejectCanvas })).rejects.toThrow('Invalid preview')
    await expect(renderPDFJSPreview(page, [0, 0, 100, 100], { maxPixels: 100, createCanvas: rejectCanvas })).rejects.toThrow('pixel limit')
    await expect(renderPDFJSPreview(page, [0, 0, 10, 10], { scale: Infinity, createCanvas: rejectCanvas })).rejects.toThrow('Invalid preview')
  })
})

test('PDF.js extraction, detection and page-crop preview fit the DetectedGraph API', async () => {
  const data = new Uint8Array(await readFile(new URL('./assets/exotic.pdf', import.meta.url)))
  const task = getDocument({ data, stopAtErrors: true, useSystemFonts: true })
  try {
    const page = await (await task.promise).getPage(3)
    const { paths } = await extractPDFJSPage(page)
    const drawings = group_paths_by_bb(paths)
    expect(drawings.length).toBeGreaterThan(0)
    const drawing = drawings[0]!
    const result = await Graph.toDetectedGraph(detect_graphs_from_drawing(drawing), drawing, false, undefined,
      (group, scale) => renderPDFJSPreview(page, group.getBounds(), { scale, createCanvas: createTestCanvas }))
    const { image } = await decode(result.img)
    expect(result.boundingBox).toEqual(drawing.getBounds())
    expect(image.width).toBe(Math.ceil((result.boundingBox[2] - result.boundingBox[0]) * 2))
    expect(image.height).toBe(Math.ceil((result.boundingBox[3] - result.boundingBox[1]) * 2))
    expect(result.graph6_strings.length).toBeGreaterThan(0)
  } finally { await task.destroy() }
})

test.each(['plain.pdf', 'multi.pdf', 'single_page.pdf', 'multi_page.pdf', 'transforms.pdf', 'exotic.pdf'])(
  'renders every page of %s without external fetches', async fixture => {
    const data = new Uint8Array(await readFile(new URL(`./assets/${fixture}`, import.meta.url)))
    const task = getDocument({ data, stopAtErrors: true, useSystemFonts: true })
    try {
      const doc = await task.promise
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const viewport = page.getViewport({ scale: 1 })
        const png = await renderPDFJSPreview(page, [0, 0, viewport.width, viewport.height], { scale: 0.5, createCanvas: createTestCanvas })
        expect(Buffer.from(png, 'base64').subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        page.cleanup()
      }
    } finally { await task.destroy() }
    expect(fetch).not.toHaveBeenCalled()
  },
)
