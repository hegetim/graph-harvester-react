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

type ZippedRow<T extends unknown[][]> = {
  [K in keyof T]: T[K][number] | undefined
}

export const zip = <T extends unknown[][]>(...arrays: T): ZippedRow<T>[] => {
  const maxLength = Math.max(0, ...arrays.map(a => a.length));
  return Array.from({ length: maxLength }, (_, i) => arrays.map(a => a[i]) as ZippedRow<T>);
};
