/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

export interface DetectedGraph {
  graph6_strings: string[]
  circles: Circle[][]
  rects: Rectangle[][]
  lines: Line[]
  beziers: Bezier[]
  boundingBox: readonly [number, number, number, number]
  caption: string
  img: string
  hog_ids: number[]
}

export interface Circle {
  radius: number
  center: Point
  index: number
}

export interface Rectangle {
  topLeft: Point
  bottomRight: Point
  index: number
}

export interface Line {
  start: Point
  stop: Point
}

export interface Bezier {
  start: Point
  p1: Point
  p2: Point
  stop: Point
}

export interface Point {
  x: number
  y: number
}
