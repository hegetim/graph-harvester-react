// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { expect } from 'vitest'
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

export const operatorNames = Object.fromEntries(Object.entries(OPS).map(([name, code]) => [code, name]))

// PDF.js 6.5.438 uses private DrawOPS codes, NOT the exported OPS codes,
// inside constructPath's packed Float32Array. This is intentionally test-only.
const commands: Record<number, { name: string; coordinates: number }> = {
  0: { name: 'moveTo', coordinates: 2 },
  1: { name: 'lineTo', coordinates: 2 },
  2: { name: 'curveTo', coordinates: 6 },
  3: { name: 'quadraticCurveTo', coordinates: 4 },
  4: { name: 'closePath', coordinates: 0 },
}

export function decodePath(args: unknown[]) {
  const [paint, chunks, bounds] = args as [number, Float32Array[], Float32Array | null]
  expect(operatorNames[paint]).toBeDefined()
  expect(Array.isArray(chunks)).toBe(true)
  const decoded: { command: string; coordinates: number[] }[] = []
  for (const chunk of chunks) {
    expect(chunk).toBeInstanceOf(Float32Array)
    for (let index = 0; index < chunk.length;) {
      const code = chunk[index++]!
      const command = commands[code]
      if (!command) throw new Error(`Unknown PDF.js DrawOPS code ${code}`)
      const coordinates = Array.from(chunk.subarray(index, index + command.coordinates))
      expect(coordinates).toHaveLength(command.coordinates)
      expect(coordinates.every(Number.isFinite)).toBe(true)
      decoded.push({ command: command.name, coordinates })
      index += command.coordinates
    }
  }
  if (bounds !== null) {
    expect(bounds).toHaveLength(4)
    expect(Array.from(bounds).every(Number.isFinite)).toBe(true)
    expect(bounds[0]).toBeLessThanOrEqual(bounds[2]!)
    expect(bounds[1]).toBeLessThanOrEqual(bounds[3]!)
  }
  return { paint: operatorNames[paint]!, commands: decoded, bounds: bounds && Array.from(bounds) }
}
