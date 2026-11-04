/* SPDX-FileCopyrightText: 2026 Jonas Spies <jonas.spies@stud-mail.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import * as geometry_utils from "./geometry_utils.js"
import { Drawing, Path_Metadata } from './wrappers.js'


const DRAWING_AREA_THRESHOLD = 500 //minimum area a drawing needs to have to be considered


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


