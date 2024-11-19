/* SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import React, { useState } from "react";
import { DetectedGraph } from "../model/Graph.js";
import { sendPdf } from "../model/Upload.js";
import { SelectFile } from "./SelectFile.js";
import { ResultsComponent } from "./ResultsComponent.js";
import { Spinner } from "./Spinner.js";
import _ from "lodash";
import "./App.css";

type State = { type: 'new-upload' }
  | { type: 'processing', filename: string }
  | { type: 'error', msg: string }
  | { type: 'results', data: DetectedGraph[] };

type Props = { baseUrl?: string, hogUrl?: string, showUrlInput?: boolean };

export const GraphHarvesterApplet = ({
  baseUrl = "https://projekte-ls6.informatik.uni-wuerzburg.de/graph_harvester",
  hogUrl = "https://houseofgraphs.org/graphs",
  showUrlInput,
}: Props) => {
  const [state, setState] = useState<State>({ type: 'new-upload' });

  const handleNewFile = async (file: File) => {
    setState({ type: 'processing', filename: file.name });
    return sendPdf(baseUrl, file).then(raw => {
      if (_.isArray(raw)) {
        setState({ type: 'results', data: raw });
        return undefined;
      } else {
        console.log(raw);
        return Promise.reject("unexpected backend response");
      }
    }).catch(err => setState({ type: 'error', msg: String(err) }));
  }

  return <div className="gh__applet-main-container">
    <h4>Graph Harvester</h4>
    {state.type === 'new-upload' || state.type === 'error' ? <div className="gh__main-page-manual">{manual}</div> : ""}
    {state.type === 'new-upload' || state.type === 'error' ? <SelectFile acceptFile={handleNewFile} showUrlInput={showUrlInput} /> : ""}
    {state.type === 'error' ? <div className="gh__main-page-error" >{state.msg}</div> : ""}
    {state.type === 'processing' ? <Spinner message={`Processing ${state.filename}... This may take a while.`} /> : ""}
    {state.type === 'results' ? <ResultsComponent hogUrl={hogUrl} graphs={state.data} reset={() => setState({ type: 'new-upload' })} /> : ""}
  </div>;
}

const manual = "If you upload a pdf file containing vector-based graph drawings, the system will extract corresponding"
  + " graphs and provide their downloadable adjacency matrices.";

export default GraphHarvesterApplet
