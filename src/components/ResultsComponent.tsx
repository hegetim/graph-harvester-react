/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useState } from "react";
import { Circle, DetectedGraph, Rectangle } from "../model/Graph.js";
import { DetectedGraphComponent } from "./DetectedGraphComponent.js";
import "./ResultsComponent.css";
import _ from "lodash";

export const ResultsComponent = (props: { graphs: DetectedGraph[], reset: () => void, hogUrl: string }) => {
  const [index, setIndex] = useState(0);
  const max = props.graphs.length;
  const graph = props.graphs[index]!;

  useEffect(() => {
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowLeft') { setIndex(i => Math.max(0, i - 1)); }
      if (ev.key === 'ArrowRight') { setIndex(i => Math.min(max - 1, i + 1)); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [setIndex, max]);

  return <div className="gh__results-container">
    <button className="gh__button gh__navigation-prev btn btn-primary" disabled={index === 0}
      onClick={() => setIndex(i => Math.max(0, i - 1))}>Previous</button>
    <div className="gh__navigation-index-label">{`${index + 1}/${max}`}</div>
    <button className="gh__button gh__navigation-next btn btn-primary" disabled={index === max - 1}
      onClick={() => setIndex(i => Math.min(max - 1, i + 1))}>Next</button>
    <button className="gh__navigation-new-upload gh__button btn btn-primary" onClick={props.reset}>New Upload</button>
    <div className="gh__results-left-container">
      <DetectedGraphComponent graph={graph} index={index} />
      <div className="gh__results-caption-small">Graph produced by Graph Harvester</div>
    </div>
    <div className="gh__results-right-container">
      <img className="gh__original-img" src={`data:image/png;base64,${graph.img}`} />
      <div className="gh__results-caption-small">Original from pdf</div>
    </div>
    <div className="gh__results-caption-big">{graph.caption}</div>
    <div className="gh__results-table-container">
      <table className="gh__results-table">
        <thead><tr><th>Graph6 String</th><th>House of Graphs Link</th></tr></thead>
        <tbody>{makeTableRows(props.graphs[index]!, props.hogUrl)}</tbody>
      </table>
    </div>
  </div>;
}

const makeTableRows = (g: DetectedGraph, hogUrl: string) => {
  if (g.graph6_strings.length === 0) {
    return <tr><td colSpan={2}>No interesting graphs found.</td></tr>;
  } else {
    return _.zip(g.graph6_strings, g.hog_ids, g.circles, g.rects).filter(x => x[0]).map(([g6, hog, circs, rects], i) =>
      <tr key={`${i}${g6}`}>
        <td>
          <div className="gh__results-table-g6cell">
            <span className="gh__results-table-g6str">{g6?.replace(">>graph6<<", "")}</span>
            <div className="gh__results-table-cpy-btn" onClick={() => navigator.clipboard.writeText(g6 ?? "")}>⧉</div>
          </div>
        </td>
        <td>
          {(hog ?? -1) !== -1
            ? <a href={`${hogUrl}/${hog}`} target="_blank">{`${hogUrl}/${hog}`}</a>
            : <React.Fragment>Not found. You may <a href={mkHoGUrl(g6 ?? "", circs ?? [], rects ?? [])} target="_blank">add</a> it.</React.Fragment>}
        </td>
      </tr>
    );
  }
}

const mkHoGUrl = (graph6: string, circles: Circle[], rects: Rectangle[]) => {
  const result: string[] = [];

  const vertices = rects.map(rect => ({
    x: (rect.topLeft.x + rect.bottomRight.x) / 2,
    y: (rect.topLeft.y + rect.bottomRight.y) / 2,
    index: rect.index,
  })
  ).concat(circles.map(c => ({ ...c.center, index: c.index })));

  const max_x = Math.floor(Math.max(...vertices.map(v => v.x)));
  const max_y = Math.floor(Math.max(...vertices.map(v => v.y)));

  // Sort based on index
  vertices.sort((a, b) => a.index - b.index);

  // Loop over all items in the data array
  vertices.forEach(vertex => {
    let x = vertex.x;
    // limit to 6 digits
    if (max_x > 999999) {
      x *= 999999 / max_x;
    }
    let x_str = Math.floor(x).toString();

    let y = vertex.y;
    // limit to 6 digits
    if (max_y > 999999) {
      y *= 999999 / max_y;
    }
    let y_str = Math.abs(Math.floor(y) - Math.min(max_y, 999999)).toString();  // y has to be inverted for HoG

    // Add to the result array in the required format
    result.push(`${x_str}_${y_str}`);
  });

  const encodedGraph6 = encodeURIComponent(graph6.replace(">>graph6<<", ""));
  return `https://houseofgraphs.org/draw_graph/?g6=${encodedGraph6}&cs=${result.join('_')}`;
}


