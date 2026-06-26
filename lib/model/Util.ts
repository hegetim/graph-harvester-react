/* SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

export type ClassNames = (string | { [index: string]: boolean })[];
export const cls = (...names: ClassNames) => {
  const joined = names.flatMap(name =>
    typeof name === 'string' ? [name] : Object.entries(name).filter(([_, flag]) => flag).map(([s, _]) => s)
  ).join(" ");
  return { className: joined };
}

export const zip = <T extends unknown[][]>(...arrays: T):
  ({ [K in keyof T]: (T[K] extends (infer U)[] ? U : never) | undefined })[] => {
  const maxLength = Math.max(0, ...arrays.map(a => a.length));
  return Array.from({ length: maxLength }, (_, i) => arrays.map(a => a[i]) as any);
};
