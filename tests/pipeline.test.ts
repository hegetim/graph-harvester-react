// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises'
import { expect, test, vi } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { fileURLToPath } from 'node:url'
import { execute_file as executePDFJS } from '../lib/harvester/pipeline'
import { executeReference } from './mupdf-reference'
import { harvestFile } from '../lib/harvester/browser'
import { patternFixture, pdfFixture } from './pdf-fixture'

function execute_file(file: ArrayBuffer | Uint8Array<ArrayBufferLike>, options: { hog: boolean; hogEnquiryUrl?: string; logs?: string[] }) {
  return executePDFJS(file, {
    ...options,
    logs: options.logs ?? [],
    previewOptions: { createCanvas: (width, height) => createCanvas(width, height) as unknown as HTMLCanvasElement },
    pdfOptions: { useSystemFonts: false, standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)) },
  })
}

const fixtures = ['plain.pdf', 'multi.pdf', 'single_page.pdf', 'multi_page.pdf', 'transforms.pdf', 'exotic.pdf']

// Ignore sub-millipoint floating point noise, but preserve all geometry/topology.
function normalize(value: unknown): unknown {
  if (typeof value === 'number') return Math.round(value * 1000) / 1000
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]))
  }
  return value
}

test.each(fixtures)('PDF extraction baseline: %s', async (fixture) => {
  const bytes = await readFile(new URL(`./assets/${fixture}`, import.meta.url))
  const results = await executeReference(bytes)

  for (const drawing of results) {
    // Check image validity without tying the baseline to a renderer's PNG bytes.
    expect(Buffer.from(drawing.img, 'base64').subarray(0, 8))
      .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(drawing.hog_ids).toEqual(drawing.graph6_strings.map(() => -1))
    expect(drawing.hog_errors).toEqual(drawing.graph6_strings.map(() => null))
  }
  expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  const geometry = results.map(({ img, ...drawing }) => {
    expect(img.length).toBeGreaterThan(0)
    return drawing
  })
  expect(normalize(geometry)).toMatchSnapshot()
})

test.each(fixtures)('PDF.js pipeline produces previews for %s', async fixture => {
  const bytes = await readFile(new URL(`./assets/${fixture}`, import.meta.url))
  const results = await execute_file(bytes, { hog: false })
  expect(results.length).toBeGreaterThan(0)
  for (const result of results) {
    expect(Buffer.from(result.img, 'base64').subarray(0, 8))
      .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(result.hog_ids).toEqual(result.graph6_strings.map(() => -1))
    expect(result.hog_errors).toEqual(result.graph6_strings.map(() => null))
  }
  expect(fetch).not.toHaveBeenCalled()
})

test('harvestFile uses the PDF.js pipeline and forwards the HoG endpoint', async () => {
  const bytes = await readFile(new URL('./assets/plain.pdf', import.meta.url))
  vi.stubGlobal('document', { createElement: () => createCanvas(1, 1) })
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ totalCandidates: 0 })))
  const results = await harvestFile(new File([bytes], 'plain.pdf', { type: 'application/pdf' }), { hogEnquiryUrl: '/custom/enquiry' })
  expect(results.flatMap(result => result.graph6_strings).length).toBeGreaterThan(0)
  expect(fetch).toHaveBeenCalledWith('/custom/enquiry', expect.objectContaining({ method: 'POST' }))
  expect(Buffer.from(results[0]!.img, 'base64').subarray(0, 8))
    .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
})

test('pattern colors produce a warning and a rendered preview instead of failing', async () => {
  const logs: string[] = []
  const results = await execute_file(patternFixture(), { hog: false, logs })
  expect(results.length).toBeGreaterThan(0)
  expect(logs.filter(line => line.includes('Pattern colors'))).toEqual([
    'PDF extraction, page 1: Pattern colors are treated as unknown for graph detection',
  ])
  let darkPixels = 0
  for (const result of results) {
    const img = await loadImage(Buffer.from(result.img, 'base64'))
    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! < 50) darkPixels++
  }
  expect(darkPixels).toBeGreaterThan(100)
})

test('unsupported clipping produces a page-specific diagnostic', async () => {
  const logs: string[] = []
  const results = await execute_file(pdfFixture(['0 0 100 100 re W n 10 10 80 80 re f']), { hog: false, logs })
  expect(results).toHaveLength(1)
  expect(logs).toContain('PDF extraction, page 1: Path clipping is ignored')
})

test('accepts ArrayBuffer input as well as typed PDF bytes', async () => {
  const bytes = await readFile(new URL('./assets/plain.pdf', import.meta.url))
  const original = Uint8Array.from(bytes)
  const input = original.slice()
  const typed = await execute_file(input, { hog: false })
  expect(input).toEqual(original)
  const arrayBuffer = original.slice().buffer
  const buffer = await execute_file(arrayBuffer, { hog: false })
  expect(new Uint8Array(arrayBuffer)).toEqual(original)
  expect(buffer).toEqual(typed)
})

test('processes all pages in document order', async () => {
  const first = '0 g 20 30 100 100 re f'
  const second = '0 g 150 160 80 80 re f'
  const pageOne = await execute_file(pdfFixture([first]), { hog: false })
  const pageTwo = await execute_file(pdfFixture([second]), { hog: false })
  expect(pageOne).toHaveLength(1)
  expect(pageTwo).toHaveLength(1)
  expect(await execute_file(pdfFixture([first, second]), { hog: false }))
    .toEqual([...pageOne, ...pageTwo])
})

test.each([
  { name: 'fraction bar', commands: '20 w 20 100 m 180 100 l S' },
  { name: 'open curve', commands: '5 w 20 20 m 20 120 180 120 180 20 c S' },
  { name: 'closed curve', commands: '50 20 m 90 20 120 50 120 90 c 120 130 90 160 50 160 c 10 160 10 20 50 20 c h S' },
  { name: 'filled and stroked closed curve', commands: '50 20 m 90 20 120 50 120 90 c 120 130 90 160 50 160 c 10 160 10 20 50 20 c h B' },
])('filters a drawing consisting only of a $name', async ({ commands }) => {
  expect(await execute_file(pdfFixture([commands]), { hog: false })).toEqual([])
})

test('keeps a complex non-graph drawing for review', async () => {
  const results = await execute_file(pdfFixture(['2 w 20 20 m 80 80 l 160 20 l S']), { hog: false })
  expect(results).toHaveLength(1)
  expect(results[0]!.graph6_strings).toEqual([])
  expect(Buffer.from(results[0]!.img, 'base64').subarray(0, 8))
    .toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
})

test('a blank page produces no drawings', async () => {
  expect(await execute_file(pdfFixture(['']), { hog: false })).toEqual([])
})

test('lookup failure preserves extracted geometry and reports errors', async () => {
  const bytes = await readFile(new URL('./assets/plain.pdf', import.meta.url))
  const baseline = await execute_file(bytes, { hog: false })
  expect(baseline.flatMap(drawing => drawing.graph6_strings).length).toBeGreaterThan(0)
  vi.mocked(fetch).mockRejectedValue(new TypeError('Offline'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const results = await execute_file(bytes, { hog: true, hogEnquiryUrl: '/test/enquiry' })
  expect(results.map(({ hog_errors, ...drawing }) => {
    expect(hog_errors).toEqual(drawing.graph6_strings.map(() => expect.stringContaining('possibly CORS')))
    return drawing
  })).toEqual(baseline.map(({ hog_errors, ...drawing }) => {
    expect(hog_errors).toEqual(drawing.graph6_strings.map(() => null))
    return drawing
  }))
  expect(fetch).toHaveBeenCalledWith('/test/enquiry', expect.anything())
})

test('a preview failure rejects the operation and a later extraction still succeeds', async () => {
  const data = pdfFixture(['0 g 0 0 100 100 re f'])
  await expect(executePDFJS(data, {
    hog: false,
    logs: [],
    previewOptions: { createCanvas: () => { throw new Error('canvas unavailable') } },
  })).rejects.toThrow('canvas unavailable')
  expect(await execute_file(data, { hog: false })).toHaveLength(1)
})

test('rejects malformed PDF input', async () => {
  await expect(execute_file(new Uint8Array([1, 2, 3]), { hog: false })).rejects.toThrow()
})
