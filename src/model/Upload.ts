/* SPDX-FileCopyrightText: 2024 Julius Deynet <jdeynet@googlemail.com> 
 * SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
 * SPDX-FileCopyrightText: 2024 Sebastian Kempf <sebastian.kempf@uni-wuerzburg.de>
 * SPDX-License-Identifier: MIT
 */

export const sendPdf = async (baseUrl: string, file: File) => {
  const data = new FormData();
  data.append("file", file);
  const res = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: data,
  });
  return await res.json();
}
