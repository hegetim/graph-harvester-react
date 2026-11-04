/* SPDX-FileCopyrightText: 2026 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */
import * as mupdf from 'mupdf'
import { Path_Metadata, type Drawing } from './wrappers.js'
import type { PathCommand, StrokeStyle } from './drawing-model.js'

// Temporary renderer bridge. Preserve the original MuPDF objects so uncommon
// color spaces and stroke details render exactly as before. The graph model
// contains only plain values and does not depend on these native objects.
const nativePaths = new WeakMap<Path_Metadata, {
  path: mupdf.Path; stroke?: mupdf.StrokeState; colorSpace: mupdf.ColorSpace; owner?: mupdf.DisplayList
}>()

export function strokeFromMuPDF(stroke: mupdf.StrokeState): StrokeStyle {
  return {
    lineWidth: stroke.getLineWidth(), lineCap: stroke.getLineCap(),
    lineJoin: stroke.getLineJoin(), miterLimit: stroke.getMiterLimit(),
    dashPhase: stroke.getDashPhase(), dashes: stroke.getDashes() ?? [],
  }
}

export function pathFromMuPDF(path: mupdf.Path, bounds: mupdf.Rect, ctm: mupdf.Matrix,
  type: 'fill' | 'stroke', colorSpace: mupdf.ColorSpace, color: number[],
  alpha: number, stroke?: mupdf.StrokeState, evenOdd?: boolean): Path_Metadata {
  const commands: PathCommand[] = []
  path.walk({
    moveTo: (x, y) => commands.push({ type: 'moveTo', x, y }),
    lineTo: (x, y) => commands.push({ type: 'lineTo', x, y }),
    curveTo: (x1, y1, x2, y2, x3, y3) => commands.push({ type: 'curveTo', x1, y1, x2, y2, x3, y3 }),
    closePath: () => commands.push({ type: 'closePath' }),
  })
  const result = new Path_Metadata(commands, [...bounds], [...ctm], type,
    { space: colorSpace.getType(), components: [...color] }, alpha,
    stroke ? strokeFromMuPDF(stroke) : undefined, evenOdd)
  nativePaths.set(result, { path, stroke, colorSpace })
  return result
}

export function get_paths_from_page(page: mupdf.Page): Path_Metadata[] {
  const list = page.toDisplayList()
  const paths: Path_Metadata[] = []
  const device = new mupdf.Device({
    fillPath(path, evenOdd, ctm, colorSpace, color, alpha) {
      const result = pathFromMuPDF(path, path.getBounds(null as unknown as mupdf.StrokeState, ctm), ctm,
        'fill', colorSpace, color, alpha, undefined, evenOdd)
      nativePaths.get(result)!.owner = list
      paths.push(result)
    },
    strokePath(path, stroke, ctm, colorSpace, color, alpha) {
      const result = pathFromMuPDF(path, path.getBounds(stroke, ctm), ctm,
        'stroke', colorSpace, color, alpha, stroke)
      nativePaths.get(result)!.owner = list
      paths.push(result)
    },
  })
  try {
    list.run(device, mupdf.Matrix.identity)
    device.close()
    return paths
  } finally {
    device.destroy()
    // Borrowed paths belong to the display list. Keep it alive via nativePaths.
    // MuPDF's finalizer releases it once no extracted paths are referenced.
  }
}

/** Current MuPDF preview; will be replaced with page rendering in step 5. */
export function renderDrawing(drawing: Drawing, scale = 5): Uint8Array<ArrayBufferLike> {
  const matrix = mupdf.Matrix.scale(scale, scale)
  const bounds = drawing.getBounds().map(value => value * scale) as mupdf.Rect
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, bounds, false)
  const device = new mupdf.DrawDevice(matrix, pixmap)
  try {
    pixmap.clear(255)
    for (const path of drawing.paths) {
      const native = nativePaths.get(path)
      if (!native) throw new Error('MuPDF preview requires paths created by the MuPDF adapter')
      if (path.type === 'fill') {
        device.fillPath(native.path, path.evenOdd ?? false, path.ctm, native.colorSpace, path.color as mupdf.Color, path.alpha)
      } else {
        if (!native.stroke) throw new Error('MuPDF stroke path has no stroke state')
        device.strokePath(native.path, native.stroke, path.ctm, native.colorSpace, path.color as mupdf.Color, path.alpha)
      }
    }
    device.close()
    return pixmap.asPNG()
  } finally {
    device.destroy()
    pixmap.destroy()
  }
}
