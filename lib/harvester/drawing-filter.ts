/* SPDX-FileCopyrightText: 2026 Tim Hegemann
 * SPDX-License-Identifier: MIT
 */

import type { PathCommand } from './drawing-model.js'
import type { Drawing } from './wrappers.js'

/** True only for geometry that cannot contain a meaningful graph by itself. */
function isTrivialContour(commands: PathCommand[]): boolean {
  let start: { x: number; y: number } | undefined
  let end: { x: number; y: number } | undefined
  let lines = 0
  let curves = 0
  let closed = false

  for (const command of commands) {
    switch (command.type) {
      case 'moveTo':
        // Multiple subpaths may represent several objects, even in one path.
        if (start) return false
        start = { x: command.x, y: command.y }
        end = start
        break
      case 'lineTo':
        if (!start || closed) return false
        lines++
        end = { x: command.x, y: command.y }
        break
      case 'curveTo':
        if (!start || closed) return false
        curves++
        end = { x: command.x3, y: command.y3 }
        break
      case 'closePath':
        if (!start || closed) return false
        closed = true
        break
    }
  }

  if (!start || !end) return false
  // An explicitly closed path and a curve ending at its starting point are
  // both common representations of a single closed contour.
  closed ||= end.x === start.x && end.y === start.y
  const segments = lines + curves
  if (segments === 1) return true
  return closed && lines === 0 && curves > 0
}

/**
 * Conservatively filter one isolated line, curve, or closed curved contour.
 * PDF.js emits separate paths when identical geometry is filled and stroked;
 * count those as one contour. Ambiguous or distinct geometry is retained.
 */
export function isTrivialDrawing(drawing: Drawing): boolean {
  if (drawing.paths.length === 0) return false
  const first = drawing.paths[0]!
  if (!isTrivialContour(first.path)) return false
  const key = JSON.stringify([first.ctm, first.path])
  return drawing.paths.every(path => JSON.stringify([path.ctm, path.path]) === key)
}
