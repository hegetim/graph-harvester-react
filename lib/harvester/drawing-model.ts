/* SPDX-FileCopyrightText: 2026 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

/** Page-space affine transform and axis-aligned bounds. */
export type Matrix = [number, number, number, number, number, number]
export type Rect = [number, number, number, number]

export type PathCommand =
  | { type: 'moveTo' | 'lineTo'; x: number; y: number }
  | { type: 'curveTo'; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { type: 'closePath' }

/** Stroke values are kept in the source coordinate system, like the path. */
export interface StrokeStyle {
  lineWidth: number
  lineCap: number
  lineJoin: number
  miterLimit: number
  dashPhase: number
  dashes: number[]
}

/** The original color-space name and components are retained for filtering. */
export interface PathColor {
  space: string
  components: number[]
}

export const identityMatrix: Matrix = [1, 0, 0, 1, 0, 0]
export const defaultStroke: StrokeStyle = {
  lineCap: 0, lineJoin: 2, lineWidth: 0, miterLimit: 1.414, dashPhase: 0, dashes: [],
}
