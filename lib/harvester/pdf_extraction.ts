/* SPDX-FileCopyrightText: 2026 Jonas Spies <jonas.spies@stud-mail.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import * as mupdf from 'mupdf'
import * as geometry_utils from "./geometry_utils.js"
import { Drawing, Path_Metadata } from './wrappers.js'


const DRAWING_AREA_THRESHOLD = 500 //minimum area a drawing needs to have to be considered


/** Simply extracts a list of Path objects from a Page */
export function get_paths_from_page(page: mupdf.Page): Path_Metadata[] {
  const list = page.toDisplayList()
  const paths: Path_Metadata[] = []
  const traceDevice = new mupdf.Device({ // Object used to extract Path elements
    strokeText(_text: any) { },
    fillImage(_image: any) { },
    fillPath(path: mupdf.Path, evenOdd: boolean, ctm: mupdf.Matrix, colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number) {
      const data = new Path_Metadata(path, path.getBounds(null as any, ctm), ctm, "fill", colorSpace, color, alpha, undefined, evenOdd)
      paths.push(data)
    },
    clipPath(_path: mupdf.Path, _evenOdd: boolean, _ctm: mupdf.Matrix) {
    },
    strokePath(path: mupdf.Path, stroke: mupdf.StrokeState, ctm: mupdf.Matrix, colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number) {
      const data = new Path_Metadata(path, path.getBounds(stroke, ctm), ctm, "stroke", colorSpace, color, alpha, stroke, undefined)
      paths.push(data)
    },
    clipStrokePath(_path: mupdf.Path, _stroke: mupdf.StrokeState, _ctm: mupdf.Matrix) {
    }
  })
  list.run(traceDevice, mupdf.Matrix.identity)
  return paths;
}


/** Turns a list of Path objects into a clustered list of Drawings, based on overlapping bounding boxes. */
export function group_paths_by_bb(paths: Path_Metadata[]): Drawing[] {
  let drawings: Drawing[] = paths.map(path => new Drawing([path], path.getBounds()))
  let len_before = drawings.length
  let break_count = 0
  while (true) {
    const new_drawings = geometry_utils.merge_bounding_boxes(drawings)
    if (new_drawings.length == len_before)
      break_count += 1
    if (break_count >= 3)
      break
    drawings = new_drawings
    len_before = new_drawings.length
  }
  return drawings.filter((x) => {
    const res = (x.area() > DRAWING_AREA_THRESHOLD)
    return res
  })
}


