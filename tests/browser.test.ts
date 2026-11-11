// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { expect, test, vi } from 'vitest'
import { execute_file } from '../lib/harvester/pipeline'
import { harvestFile } from '../lib/harvester/browser'

vi.mock('../lib/harvester/pipeline', () => ({ execute_file: vi.fn() }))

test('harvestFile forwards file bytes and lookup options', async () => {
  const file = new File(['PDF fixture'], 'graph.pdf', { type: 'application/pdf' })
  vi.mocked(execute_file).mockResolvedValueOnce([])
  expect(await harvestFile(file, { hogEnquiryUrl: '/custom/enquiry' })).toEqual([])
  expect(execute_file).toHaveBeenLastCalledWith(await file.arrayBuffer(), {
    hog: true,
    hogEnquiryUrl: '/custom/enquiry',
  })
})

test('harvestFile forwards optional PDF.js resource paths', async () => {
  const file = new File([], 'sample.pdf')
  vi.mocked(execute_file).mockResolvedValueOnce([])
  await harvestFile(file, { pdfjsAssetsUrl: '/assets/pdfjs///' })
  expect(execute_file).toHaveBeenLastCalledWith(await file.arrayBuffer(), {
    hog: true,
    pdfOptions: {
      cMapUrl: '/assets/pdfjs/cmaps/',
      standardFontDataUrl: '/assets/pdfjs/standard_fonts/',
      wasmUrl: '/assets/pdfjs/wasm/',
      iccUrl: '/assets/pdfjs/iccs/',
    },
  })
})

test('harvestFile enables lookup by default', async () => {
  const file = new File([], 'empty.pdf')
  vi.mocked(execute_file).mockResolvedValueOnce([])
  await harvestFile(file)
  expect(execute_file).toHaveBeenLastCalledWith(await file.arrayBuffer(), { hog: true })
})

test('harvestFile propagates extraction errors', async () => {
  vi.mocked(execute_file).mockRejectedValueOnce(new Error('Invalid PDF'))
  await expect(harvestFile(new File([], 'bad.pdf'))).rejects.toThrow('Invalid PDF')
})
