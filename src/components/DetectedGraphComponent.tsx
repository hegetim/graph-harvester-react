/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { Bezier, Circle, DetectedGraph, Line, Rectangle } from "../model/Graph.js";

export const DetectedGraphComponent = (props: { graph: DetectedGraph, index: number }) => {
  try {
    return reproduceDrawing(props.graph, props.index);
  } catch (err) {
    console.error(err);
    return <div className="gh__repr-error">could not reproduce detected graph #{props.index + 1}</div>;
  }
}

const reproduceDrawing = (g: DetectedGraph, i: number) => {
  if (g.lines.length === 0 && g.beziers.length === 0 && g.circles.length === 0 && g.rects.length === 0) {
    return <div className="gh__graph-no-results">no graph found</div>;
  } else {
    const [left, top, right, bottom] = g.boundingBox;
    return <svg className="gh__repr-svg" viewBox={`${left} ${top} ${right - left} ${bottom - top}`}>
      {reproduceLines(g.lines, i)}
      {reproduceBeziers(g.beziers, i)}
      {reproduceCircles(g.circles.flat(), i)}
      {reproduceRects(g.rects.flat(), i)}
    </svg>;
  }
}

const reproduceLines = (lines: Line[], i: number) => lines.map((l, j) =>
  <line key={`${i}l${j}`} className={`gh__repr-line`} x1={l.start.x} y1={l.start.y} x2={l.stop.x} y2={l.stop.y} />
);

const reproduceBeziers = (beziers: Bezier[], i: number) => beziers.map((b, j) =>
  <path key={`${i}b${j}`} className={`gh__repr-bezier`}
    d={`M${b.start.x} ${b.start.y}C${b.p1.x} ${b.p1.y} ${b.p2.x} ${b.p2.y} ${b.stop.x} ${b.stop.y}`} />
);

const reproduceCircles = (circles: Circle[], i: number) => circles.map((c, j) =>
  <circle key={`${i}c${j}`} className={`gh__repr-circle`} cx={c.center.x} cy={c.center.y} r={c.radius} />
);

const reproduceRects = (rects: Rectangle[], i: number) => rects.map((r, j) =>
  <rect key={`${i}r${j}`} className={`gh__repr-rect`}
    x={r.topLeft.x} y={r.topLeft.y} width={r.bottomRight.x - r.topLeft.x} height={r.bottomRight.y - r.topLeft.y} />
);

