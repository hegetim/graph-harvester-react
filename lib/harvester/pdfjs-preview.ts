/* SPDX-FileCopyrightText: 2026 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import type { Rect } from './drawing-model.js'

export interface PreviewOptions {
  /** Pixels per PDF viewport unit. Drawing bounds are in the scale-1 viewport. */
  scale?: number
  /** Limit memory use; requests exceeding it fail rather than silently rescale. */
  maxPixels?: number
  /** Override the browser canvas factory (e.g. for Node tests). */
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

const DEFAULT_MAX_PIXELS = 16_777_216

/**
 * Render the original page into a crop. Bounds are in the same scale-1,
 * top-left viewport coordinates as the PDF.js extraction adapter. The crop
 * remains aligned with the detected geometry, including outside-page margins.
 * Returns the base64-encoded PNG expected by DetectedGraph.img.
 *
 * The caller owns the page/document and must keep them alive until this resolves.
 */
export async function renderPDFJSPreview(page: PDFPageProxy, bounds: Rect, options: PreviewOptions = {}): Promise<string> {
  const scale = options.scale ?? 2
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS
  const [left, top, right, bottom] = bounds
  if (!bounds.every(Number.isFinite) || right <= left || bottom <= top || !Number.isFinite(scale) || scale <= 0) {
    throw new Error('Invalid preview bounds or scale')
  }
  if (!Number.isSafeInteger(maxPixels) || maxPixels <= 0) throw new Error('Invalid preview pixel limit')
  const width = Math.ceil((right - left) * scale)
  const height = Math.ceil((bottom - top) * scale)
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > maxPixels) {
    throw new Error(`Preview exceeds pixel limit (${maxPixels})`)
  }
  const createCanvas = options.createCanvas ?? ((w, h) => {
    if (typeof document === 'undefined') throw new Error('A browser canvas or createCanvas option is required for PDF previews')
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    return canvas
  })
  const canvas = createCanvas(width, height)
  if (canvas.width !== width || canvas.height !== height) throw new Error('Preview canvas has incorrect dimensions')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create preview canvas context')
  const viewport = page.getViewport({ scale })
  try {
    // White outside the page too, without stretching a crop at the page edge.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.save()
    try {
      context.beginPath()
      context.rect(-left * scale, -top * scale, viewport.width, viewport.height)
      context.clip()
      await page.render({ canvas: null, canvasContext: context, viewport,
        transform: [1, 0, 0, 1, -left * scale, -top * scale],
        intent: 'display', background: '#fff' }).promise
    } finally {
      context.restore()
    }
    const dataURL = canvas.toDataURL('image/png')
    const prefix = 'data:image/png;base64,'
    if (!dataURL.startsWith(prefix)) throw new Error('Canvas did not encode a PNG preview')
    return dataURL.slice(prefix.length)
  } finally {
    // Browser backing stores can be large; do not retain them after encoding.
    canvas.width = 0
    canvas.height = 0
  }
}
