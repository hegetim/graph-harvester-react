/* SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

import _ from "lodash";

export type ClassNames = (string | { [index: string]: boolean })[];
export const cls = (...names: ClassNames) => {
  const joined = names.flatMap(name =>
    _.isString(name) ? [name] : _.toPairs(name).filter(([_, flag]) => flag).map(([s, _]) => s)
  ).join(" ");
  return { className: joined };
}
