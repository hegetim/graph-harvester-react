/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import "./Spinner.css";

export const Spinner = (props: { message: string }) => <div className="gh__spinner-container">
  <div className="gh__spinner-center">
    <div className="gh__spinner-edge" id="gh__spinner-edge1" />
    <div className="gh__spinner-edge" id="gh__spinner-edge2" />
    <div className="gh__spinner-edge" id="gh__spinner-edge3" />
    <div className="gh__spinner-edge" id="gh__spinner-edge4" />
    <div className="gh__spinner-ray" />
    <div className="gh__spinner-node" id="gh__spinner-node1" />
    <div className="gh__spinner-node" id="gh__spinner-node2" />
    <div className="gh__spinner-node" id="gh__spinner-node3" />
    <div className="gh__spinner-node" id="gh__spinner-node4" />
  </div>
  <p className="gh__spinner-message">{props.message}</p>
</div>
