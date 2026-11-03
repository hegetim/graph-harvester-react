import { readFile } from 'node:fs/promises'
import { expect, test, vi } from 'vitest'
import { execute_file } from '../lib/harvester/pipeline'
import { pdfFixture } from './pdf-fixture'

const fixtures = ['plain.pdf', 'multi.pdf', 'single_page.pdf', 'multi_page.pdf']

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
  const results = await execute_file(bytes, { hog: false })

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

test('accepts ArrayBuffer input as well as typed PDF bytes', async () => {
  const bytes = await readFile(new URL('./assets/plain.pdf', import.meta.url))
  const typed = await execute_file(bytes, { hog: false })
  const buffer = await execute_file(Uint8Array.from(bytes).buffer, { hog: false })
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

test('rejects malformed PDF input', async () => {
  await expect(execute_file(new Uint8Array([1, 2, 3]), { hog: false })).rejects.toThrow()
})
