<!--- SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
      SPDX-License-Identifier: CC-BY-4.0
--->
graph-harvester-react
=====================

React port of the [graph harvester](https://github.com/JuliusDeynet/graph_harvester) webapp.  
Graph Harvester is a program that extracts graphs from drawings of graphs in pdf files.
We focus on the problem of extracting graphs from vector data, which is the primary format
used in publications nowadays.

Play with our [demo instance](https://www1.pub.informatik.uni-wuerzburg.de/pub/hegemann/harvester/).


How To Use
----------

The package is ESM-only. Use the Graph Harvester applet like any other React component.

```jsx
<GraphHarvesterApplet />
```

The applet can be customized via optional properties.

 * `baseUrl`: the url of the backend component
 * `hogUrl`: the House of Graphs url
 * `showUrlInput`: enables users to fetch PDFs from URLs instead of uploading files.
   It defaults to `false`: browser requests depend on the remote server permitting
   CORS, and a backend proxy that fetches arbitrary URLs introduces security risks
   such as server-side request forgery (SSRF). Enable it only if those trade-offs
   are acceptable; this package does not provide a URL-fetching proxy.
 * `useHogProxy`: defaults to `true`; local extraction uses `/hog-api/enquiry`.
   Set to `false` to contact `https://houseofgraphs.org/api/enquiry` directly,
   e.g. when hosted on that same origin. This does not affect remote backends.

For local extraction, pass `harvestFile` as the callback so it receives the
component's lookup options (custom callbacks must forward the second argument):

```jsx
<GraphHarvesterApplet
  backend={{ type: 'local', callback: harvestFile }}
  useHogProxy={false}
/>
```

Failed lookups preserve the extracted graph and report an error beside its
HoG link and in the browser console rather than claiming the graph is absent. Browsers cannot reliably distinguish CORS failures
from other network failures, so the error mentions both possibilities.

Local extraction now uses PDF.js. The library build emits a worker from the same
pinned PDF.js version; deploy the worker asset alongside the generated library
chunks, and allow it under your site's `worker-src` Content Security Policy.
The demo's Vite build emits the worker under its configured base path. Other
consumer bundlers and real-browser deployments still need verification.

Some PDFs need PDF.js auxiliary resources (CMaps, standard fonts, WebAssembly,
and ICC profiles). They are **not currently bundled automatically**. To enable
these, copy the `cmaps`, `standard_fonts`, `wasm`, and `iccs` directories from
the installed `pdfjs-dist` package to a publicly served directory, preserving
their names, and forward that directory URL to `harvestFile`:

```jsx
<GraphHarvesterApplet
  backend={{
    type: 'local',
    callback: (file, options) => harvestFile(file, {
      ...options,
      pdfjsAssetsUrl: '/pdfjs-assets/',
    }),
  }}
/>
```

Use the URL appropriate for your deployment base path. Without these assets,
PDF.js may be unable to render or interpret PDFs that need them. Extraction
currently ignores clipping and reports this and other known limitations in the
browser console. Pattern colors are treated as unknown for graph detection,
so results may differ; page previews still render the original patterns. Stroke
bounds are approximate. Test representative documents before relying on local extraction.

For local extraction, drawings consisting solely of a single line, open curve,
or closed curved contour are omitted as unlikely graph drawings. More complex
figures remain in the results even when no graph is detected, so they can be reviewed.
PDF annotation appearances are excluded from graph detection but remain visible
in page previews.

The demo defaults to proxying; open `/?hogProxy=false` to test direct requests.
Vite supplies the development/preview proxy only. Production webservers must
configure `/hog-api/*` to forward to `https://houseofgraphs.org/api/*` if proxying
is enabled; the static build does not include a proxy server.


Development and tests
---------------------

From the package directory:

```sh
npm ci
npm test
npm run test:watch
npm run build
```

The build type-checks the library, build configuration, and tests. Tests and PDF
fixtures are not included in the production bundle or npm package. See
[tests/README.md](tests/README.md) for coverage, snapshot updates, and fixture notes.


Publication
-----------

Most of the algorithms are described in

Julius Deynet, Tim Hegemann, Sebastian Kempf, Alexander Wolff.
[Graph Harvester (Software Abstract).](https://doi.org/10.4230/LIPIcs.GD.2024.58)
GD2024, vol.320 of LIPIcs, pp.58:01–58:03, Schloss Dagstuhl – Leibniz-Zentrum für Informatik (2024)


Contributors
------------

This library has been developed by the [algorithms and complexity group](https://www.informatik.uni-wuerzburg.de/algo)
in cooperation with the [applied computer science group](https://www.informatik.uni-wuerzburg.de/is),
University of Würzburg, Germany.

For contact, you can write an email to ``hegemann *at* informatik *dot* uni-wuerzburg *dot* de``.


