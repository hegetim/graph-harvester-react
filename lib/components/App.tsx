/* SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import { useState } from "react";
import type { DetectedGraph } from "../model/Graph";
import { sendPdf } from "../model/Upload";
import { SelectFile } from "./SelectFile";
import { ResultsComponent } from "./ResultsComponent";
import { Spinner } from "./Spinner";
import "./App.css";

type State = { type: 'new-upload' }
  | { type: 'processing', filename: string }
  | { type: 'error', msg: string }
  | { type: 'results', data: DetectedGraph[] };

export type GraphHarvesterProps = { backend?: Backend, hogUrl?: string, showUrlInput?: boolean };

export type Backend = { type: 'local', callback: (file: File) => Promise<DetectedGraph[]> }
  | { type: 'remote', url: string };

export const GraphHarvesterApplet = ({
  backend = { type: 'remote', url: "https://projekte-ls6.informatik.uni-wuerzburg.de/graph_harvester" },
  hogUrl = "https://houseofgraphs.org/graphs",
  showUrlInput,
}: GraphHarvesterProps) => {
  const [state, setState] = useState<State>({ type: 'new-upload' });

  const handleNewFile = async (file: File) => {
    setState({ type: 'processing', filename: file.name });
    return (backend.type === 'local' ?
      backend.callback(file).then(data => setState({ type: 'results', data })) :
      sendPdf(backend.url, file).then(raw => {
        if (Array.isArray(raw)) {
          setState({ type: 'results', data: raw });
          return undefined;
        } else {
          console.log(raw);
          return Promise.reject("unexpected backend response");
        }
      })
    ).catch(err => setState({ type: 'error', msg: String(err) }));
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
