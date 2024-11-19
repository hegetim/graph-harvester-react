/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import React, { useCallback, useRef, useState } from "react";
import { cls } from "../model/Util.js";
import "./SelectFile.css";
import { Spinner } from "./Spinner.js";

const fileSizeLimit = 25 * 1024 * 1024;

type State = { type: 'calm' } | { type: 'active' } | { type: 'error', msg: string } | { type: 'loading' }

type Props = { showUrlInput?: boolean | undefined, acceptFile: (file: File) => void };

export const SelectFile = ({ acceptFile, showUrlInput }: Props) => {
  const hiddenInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ type: 'calm' });
  const [urlText, setUrlText] = useState<string>("");

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) { setState({ type: 'error', msg: "something went wrong" }); }
    else if (files.length !== 1) { setState({ type: 'error', msg: "please upload only one file at a time" }); }
    else {
      const checked = checkFile(files[0])
      if (checked.type === 'pass') {
        acceptFile(checked.file);
        setState({ type: 'calm' });
      } else {
        setState(checked);
      }
    }
  }, [setState, acceptFile]);

  const handleDrop = useCallback((ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    handleFiles(ev.dataTransfer.files);
  }, [handleFiles]);

  const handleDrag = useCallback((ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    setState({ type: 'active' });
  }, [setState]);

  const handleUrl = async () => {
    setState({ type: 'loading' });
    const checked = await checkUrl(urlText);
    if (checked.type === 'pass') {
      acceptFile(checked.file);
      setState({ type: 'calm' });
    } else {
      setState(checked);
    }
  }

  if (state.type === 'loading') return <Spinner message={`downloading ${urlText}...`} />;
  else return <React.Fragment>
    <div {...cls("gh__file-select-container", { "gh__file-select-active": state.type === 'active' })}
      onClick={() => hiddenInput.current?.click()} onDrop={handleDrop}
      onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={() => setState({ type: 'calm' })}
    >
      <input ref={hiddenInput} type="file" className="gh__hidden" onChange={ev => handleFiles(ev.target.files)} />
      {state.type === 'error' ? <span className="gh__file-select-error">{state.msg}</span> : ""}
      <span className="gh__file-select-label">Drop files here or click to upload</span>
    </div>
    {showUrlInput ? <div className="gh__url-select-container">
      <input className="gh__url-select-input" type="text" placeholder="Or enter a url"
        value={urlText} onChange={ev => setUrlText(ev.target.value)} />
      <button className="gh__url-select-btn btn btn-primary" onClick={handleUrl}>open</button>
    </div> : ""}
  </React.Fragment>;
}

const checkFile = (file: File | undefined): { type: 'pass', file: File } | { type: 'error', msg: string } => {
  if (file?.type !== "application/pdf") { return { type: 'error', msg: "please upload a pdf file" }; }
  if (file.size > fileSizeLimit) { return { type: 'error', msg: "file size limit exceeded" }; }
  return { type: 'pass', file };
}

const checkUrl = async (url: string): Promise<{ type: 'pass', file: File } | { type: 'error', msg: string }> => {
  try {
    const response = await fetch(url);
    if (response.headers.get('content-type') !== 'application/pdf') {
      return { type: 'error', msg: "please upload a pdf file" };
    }
    const blob = await response.blob();
    const file = new File([blob], 'downloaded.pdf');
    if (file.size > fileSizeLimit) { return { type: 'error', msg: "file size limit exceeded" }; }
    return { type: 'pass', file };
  } catch (err) {
    return { type: 'error' as const, msg: `could not fetch url` };
  }
}

