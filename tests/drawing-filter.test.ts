// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { expect, test } from 'vitest'
import { Drawing, Path_Metadata } from '../lib/harvester/wrappers'
import { isTrivialDrawing } from '../lib/harvester/drawing-filter'
import { identityMatrix, type Matrix, type PathCommand } from '../lib/harvester/drawing-model'

const move: PathCommand = { type: 'moveTo', x: 0, y: 0 }
const line: PathCommand = { type: 'lineTo', x: 20, y: 20 }
const curve: PathCommand = { type: 'curveTo', x1: 10, y1: 0, x2: 20, y2: 10, x3: 20, y3: 20 }
const returnCurve: PathCommand = { type: 'curveTo', x1: 20, y1: 10, x2: 10, y2: 0, x3: 0, y3: 0 }
const close: PathCommand = { type: 'closePath' }

function path(commands: PathCommand[], type: 'fill' | 'stroke' = 'fill', ctm: Matrix = [...identityMatrix]) {
  return new Path_Metadata(commands, [0, 0, 20, 20], ctm, type,
    { space: 'RGB', components: [0, 0, 0] }, 1)
}

test.each([
  { name: 'line', commands: [move, line] },
  { name: 'open cubic curve', commands: [move, curve] },
  { name: 'explicitly closed curved contour', commands: [move, curve, returnCurve, close] },
  { name: 'curved contour returning to its start', commands: [move, curve, returnCurve] },
])('filters a single $name', ({ commands }) => {
  expect(isTrivialDrawing(new Drawing([path(commands)]))).toBe(true)
})

test('recognizes the same contour painted as fill and stroke', () => {
  const commands = [move, curve, returnCurve, close]
  expect(isTrivialDrawing(new Drawing([path(commands), path(structuredClone(commands), 'stroke')]))).toBe(true)
})

test('retains distinct contours, even if they have the same commands but different transforms', () => {
  const commands = [move, curve, returnCurve, close]
  expect(isTrivialDrawing(new Drawing([path(commands), path(commands, 'stroke', [1, 0, 0, 1, 1, 0])]))).toBe(false)
  expect(isTrivialDrawing(new Drawing([path([move, line]), path([move, curve])]))).toBe(false)
})

test('retains multi-segment open paths, closed polygons, and paths with multiple subpaths', () => {
  expect(isTrivialDrawing(new Drawing([path([move, line, { type: 'lineTo', x: 40, y: 20 }])]))).toBe(false)
  expect(isTrivialDrawing(new Drawing([path([move, line, { type: 'lineTo', x: 20, y: 0 }, close])]))).toBe(false)
  expect(isTrivialDrawing(new Drawing([path([move, curve, returnCurve, close, move, line])]))).toBe(false)
})

test('retains ambiguous or empty paths instead of guessing', () => {
  expect(isTrivialDrawing(new Drawing([]))).toBe(false)
  expect(isTrivialDrawing(new Drawing([path([])]))).toBe(false)
  expect(isTrivialDrawing(new Drawing([path([curve])]))).toBe(false)
})
