/* SPDX-FileCopyrightText: 2026 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import { GraphHarvesterApplet } from "./components/App";

export { GraphHarvesterApplet };
export type { Backend, GraphHarvesterProps } from './components/App';
export { harvestFile } from './harvester/browser';
export type { DetectedGraph, Circle, Rectangle, Line, Bezier, Point } from './model/Graph';
