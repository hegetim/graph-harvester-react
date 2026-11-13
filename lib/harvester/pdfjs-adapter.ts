/* SPDX-FileCopyrightText: 2026 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

// This adapter targets the pinned PDF.js 6.5.438 operator representation.
// See tests/PDFJS-POC.md for compatibility and known limitations.
import { AnnotationMode, OPS, version } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'
import type { Matrix, PathCommand, Rect, StrokeStyle } from './drawing-model.js'
import { Path_Metadata } from './wrappers.js'

interface GraphicsState {
  ctm: Matrix
  stroke: StrokeStyle
  fill: number[]
  strokeColor: number[]
  fillPattern: boolean
  strokePattern: boolean
  fillAlpha: number
  strokeAlpha: number
}

export interface PDFJSExtraction {
  paths: Path_Metadata[]
  /** Unsupported semantics that may change which geometry should be detected. */
  warnings: string[]
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function matrix(value: ArrayLike<number>): Matrix {
  if (value.length !== 6 || !Array.from(value).every(Number.isFinite)) throw new Error('Invalid PDF.js transform')
  return Array.from(value) as Matrix
}

function cloneState(state: GraphicsState): GraphicsState {
  return { ...state, ctm: [...state.ctm], fill: [...state.fill], strokeColor: [...state.strokeColor],
    stroke: { ...state.stroke, dashes: [...state.stroke.dashes] } }
}

function rgb(value: unknown): number[] {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Unsupported PDF.js color: ${String(value)}`)
  }
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
}

/** Private DrawOPS (not OPS) in the pinned PDF.js build. */
function decodePath(chunks: unknown): PathCommand[] {
  if (!Array.isArray(chunks)) throw new Error('Unsupported PDF.js path encoding')
  const result: PathCommand[] = []
  let current: [number, number] | undefined
  let start: [number, number] | undefined
  for (const chunk of chunks) {
    if (!(chunk instanceof Float32Array)) throw new Error('Unsupported PDF.js path chunk')
    let i = 0
    const next = () => {
      if (i >= chunk.length || !Number.isFinite(chunk[i])) throw new Error('Invalid PDF.js path coordinates')
      return chunk[i++]!
    }
    while (i < chunk.length) {
      switch (next()) {
        case 0: {
          const x = next(), y = next()
          result.push({ type: 'moveTo', x, y }); current = [x, y]; start = [x, y]
          break
        }
        case 1: {
          if (!current) throw new Error('PDF.js line without a current point')
          const x = next(), y = next()
          result.push({ type: 'lineTo', x, y }); current = [x, y]
          break
        }
        case 2: {
          if (!current) throw new Error('PDF.js curve without a current point')
          const x1 = next(), y1 = next(), x2 = next(), y2 = next(), x3 = next(), y3 = next()
          result.push({ type: 'curveTo', x1, y1, x2, y2, x3, y3 }); current = [x3, y3]
          break
        }
        case 3: {
          if (!current) throw new Error('PDF.js quadratic curve without a current point')
          const x = next(), y = next(), endX = next(), endY = next()
          result.push({ type: 'curveTo', x1: current[0] + 2 * (x - current[0]) / 3,
            y1: current[1] + 2 * (y - current[1]) / 3,
            x2: endX + 2 * (x - endX) / 3, y2: endY + 2 * (y - endY) / 3,
            x3: endX, y3: endY })
          current = [endX, endY]
          break
        }
        case 4:
          // PDF.js adds closePath for s/b/b* even when there is no subpath.
          if (!start) break
          result.push({ type: 'closePath' }); current = start
          break
        default: throw new Error('Unknown PDF.js path command; check pinned PDF.js version')
      }
    }
  }
  return result
}

/** Conservative control-point bounds. Stroke expansion deliberately errs on the
 * side of inclusion; exact MuPDF bounds and grouping parity remain to verify. */
function bounds(commands: PathCommand[], ctm: Matrix, stroke?: StrokeStyle): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  function point(x: number, y: number) {
    const tx = ctm[0] * x + ctm[2] * y + ctm[4]
    const ty = ctm[1] * x + ctm[3] * y + ctm[5]
    minX = Math.min(minX, tx); minY = Math.min(minY, ty)
    maxX = Math.max(maxX, tx); maxY = Math.max(maxY, ty)
  }
  for (const command of commands) {
    if (command.type === 'moveTo' || command.type === 'lineTo') point(command.x, command.y)
    else if (command.type === 'curveTo') {
      point(command.x1, command.y1); point(command.x2, command.y2); point(command.x3, command.y3)
    }
  }
  if (!Number.isFinite(minX)) throw new Error('Cannot determine bounds of empty PDF.js path')
  if (stroke) {
    // MuPDF expands arbitrary stroked paths conservatively by the miter limit.
    const expansion = stroke.lineWidth * (stroke.lineJoin === 0 ? Math.max(1, stroke.miterLimit) : 0.5) *
      Math.max(Math.hypot(ctm[0], ctm[1]), Math.hypot(ctm[2], ctm[3]))
    minX -= expansion; minY -= expansion; maxX += expansion; maxY += expansion
  }
  return [minX, minY, maxX, maxY]
}

/** Extract drawing paths from one PDF.js page, in page-viewport coordinates.
 * Clipping is currently reported but intentionally ignored, matching MuPDF's
 * existing extractor. Callers must inspect warnings before relying on results. */
export async function extractPDFJSPage(page: PDFPageProxy): Promise<PDFJSExtraction> {
  if (version !== '6.5.438') throw new Error(`Unsupported PDF.js version ${version}; adapter requires 6.5.438`)
  // Annotation appearances have their own transforms and aren't page drawing
  // geometry. Previews render the page separately and retain annotations.
  const operators = await page.getOperatorList({ annotationMode: AnnotationMode.DISABLE })
  let state: GraphicsState = {
    ctm: matrix(page.getViewport({ scale: 1 }).transform),
    stroke: { lineWidth: 1, lineCap: 0, lineJoin: 0, miterLimit: 10, dashPhase: 0, dashes: [] },
    fill: [0, 0, 0], strokeColor: [0, 0, 0], fillPattern: false, strokePattern: false, fillAlpha: 1, strokeAlpha: 1,
  }
  const stack: GraphicsState[] = []
  const paths: Path_Metadata[] = []
  const warnings = new Set<string>()
  const pop = () => {
    const previous = stack.pop()
    if (!previous) throw new Error('Unbalanced PDF.js graphics state')
    state = previous
  }
  for (let i = 0; i < operators.fnArray.length; i++) {
    const op = operators.fnArray[i]!
    const args = operators.argsArray[i] ?? []
    switch (op) {
      case OPS.save: stack.push(cloneState(state)); break
      case OPS.restore: pop(); break
      case OPS.transform: state.ctm = multiply(state.ctm, matrix(args)); break
      case OPS.paintFormXObjectBegin:
        stack.push(cloneState(state))
        if (args[0]) state.ctm = multiply(state.ctm, matrix(args[0]))
        if (args[1]) warnings.add('Form bounding-box clipping is ignored')
        break
      case OPS.paintFormXObjectEnd: pop(); break
      case OPS.setLineWidth: state.stroke.lineWidth = args[0]; break
      case OPS.setLineCap: state.stroke.lineCap = args[0]; break
      case OPS.setLineJoin: state.stroke.lineJoin = args[0]; break
      case OPS.setMiterLimit: state.stroke.miterLimit = args[0]; break
      case OPS.setDash: state.stroke.dashes = Array.from(args[0]); state.stroke.dashPhase = args[1]; break
      case OPS.setFillRGBColor: state.fill = rgb(args[0]); state.fillPattern = false; break
      case OPS.setStrokeRGBColor: state.strokeColor = rgb(args[0]); state.strokePattern = false; break
      case OPS.setFillTransparent: state.fillAlpha = 0; break
      case OPS.setStrokeTransparent: state.strokeAlpha = 0; break
      case OPS.setGState:
        for (const [key, value] of args[0]) {
          if (key === 'ca') state.fillAlpha = value
          else if (key === 'CA') state.strokeAlpha = value
          else if (key === 'LW') state.stroke.lineWidth = value
          else if (key === 'LC') state.stroke.lineCap = value
          else if (key === 'LJ') state.stroke.lineJoin = value
          else if (key === 'ML') state.stroke.miterLimit = value
          else if (key === 'D') { state.stroke.dashes = Array.from(value[0]); state.stroke.dashPhase = value[1] }
          else if (key === 'SMask' && value) warnings.add('Soft mask is ignored')
        }
        break
      case OPS.clip: case OPS.eoClip:
        warnings.add('Path clipping is ignored'); break
      case OPS.setFillColorN:
        state.fillPattern = true
        warnings.add('Pattern colors are treated as unknown for graph detection')
        break
      case OPS.setStrokeColorN:
        state.strokePattern = true
        warnings.add('Pattern colors are treated as unknown for graph detection')
        break
      case OPS.shadingFill: warnings.add('Shading is not extracted as paths'); break
      case OPS.beginGroup: warnings.add('Transparency group semantics are not fully supported'); break
      case OPS.constructPath: {
        const paint = args[0] as number
        if (paint === OPS.endPath) break
        // PDF.js emits [null] and null bounds when a paint operator has no
        // current path. Painting an empty path is a no-op, not a path chunk.
        if (Array.isArray(args[1]) && args[1].length === 1 && args[1][0] === null && args[2] === null) break
        const commands = decodePath(args[1])
        if (!commands.length) break
        const closed = paint === OPS.closeStroke || paint === OPS.closeFillStroke || paint === OPS.closeEOFillStroke
        if (closed && commands.at(-1)?.type !== 'closePath') commands.push({ type: 'closePath' })
        const fill = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(paint)
        const stroke = [OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(paint)
        if (!fill && !stroke) throw new Error(`Unsupported PDF.js painting operation ${paint}`)
        const evenOdd = paint === OPS.eoFill || paint === OPS.eoFillStroke || paint === OPS.closeEOFillStroke
        if (fill) paths.push(new Path_Metadata(commands, bounds(commands, state.ctm), [...state.ctm], 'fill',
          { space: state.fillPattern ? 'Pattern' : 'RGB', components: state.fillPattern ? [] : [...state.fill] }, state.fillAlpha, undefined, evenOdd))
        if (stroke) {
          const style = { ...state.stroke, dashes: [...state.stroke.dashes] }
          paths.push(new Path_Metadata(commands, bounds(commands, state.ctm, style), [...state.ctm], 'stroke',
            { space: state.strokePattern ? 'Pattern' : 'RGB', components: state.strokePattern ? [] : [...state.strokeColor] }, state.strokeAlpha, style))
        }
        break
      }
    }
  }
  if (stack.length) throw new Error('Unbalanced PDF.js graphics state at end of page')
  return { paths, warnings: [...warnings] }
}
