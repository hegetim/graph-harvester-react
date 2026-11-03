import { describe, expect, test } from 'vitest'
import { transform_point, mean, median, points_equal } from '../lib/harvester/geometry_utils'
import { Path_Metadata } from '../lib/harvester/wrappers'

describe('PDF coordinate transformations', () => {
  test.each([
    { matrix: [1, 0, 0, 1, 0, 0], expected: { x: 2, y: 3 } },
    { matrix: [2, 0, 0, 3, 10, -5], expected: { x: 14, y: 4 } },
    { matrix: [0, 1, -1, 0, 0, 0], expected: { x: -3, y: 2 } },
    { matrix: [1, 0, 0, -1, 0, 100], expected: { x: 2, y: 97 } },
    { matrix: [1, 2, 3, 1, 0, 0], expected: { x: 11, y: 7 } },
  ])('$matrix maps (2, 3) to $expected', ({ matrix, expected }) => {
    expect(transform_point(matrix as [number, number, number, number, number, number], 2, 3)).toEqual(expected)
  })
})

test('vertex bounds preserve center and area', () => {
  const vertex = Path_Metadata.default({ x: 20, y: 30 }, 10)
  expect(vertex.center()).toEqual({ x: 20, y: 30 })
  expect(vertex.getBounds()).toEqual([15, 25, 25, 35])
  expect(vertex.area()).toBe(100)
  expect(vertex.height_width_ratio()).toBe(1)
})

test('statistics handle unsorted input without mutation and reject empty input', () => {
  const values = [9, 1, 2]
  expect(median(values)).toBe(2)
  expect(mean(values)).toBe(4)
  expect(values).toEqual([9, 1, 2])
  expect(() => median([])).toThrow()
  expect(() => mean([])).toThrow()
})

test('point equality compares both coordinates', () => {
  expect(points_equal({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
  expect(points_equal({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false)
})
