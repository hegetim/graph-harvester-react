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


Installation
------------

```sh
npm install @hegetim/graph-harvester-react bootstrap
```

The package is ESM-only and requires React and React DOM matching its declared
peer dependency ranges. Its component uses Bootstrap classes; load Bootstrap's
CSS in your application. The package's own CSS is imported by its JavaScript
entry point for CSS-aware bundlers. A separate stylesheet is also available as
`@hegetim/graph-harvester-react/style.css` if needed by your setup.


How To Use
----------

By default the applet uploads PDFs to its configured remote Graph Harvester
backend. To use browser-local PDF extraction instead:

```jsx
import 'bootstrap/dist/css/bootstrap.min.css'
import { GraphHarvesterApplet, harvestFile } from '@hegetim/graph-harvester-react'

export function GraphHarvester() {
  return <GraphHarvesterApplet backend={{ type: 'local', callback: harvestFile }} />
}
```

The local mode defaults to a same-origin House of Graphs proxy; see its
production setup below. You can explicitly configure another backend with
`backend={{ type: 'remote', url: 'https://example.org' }}`. The component posts
PDFs to the remote backend's `/upload` endpoint.

The applet can be customized via optional properties.

 * `backend`: select a local callback or the URL of a remote backend
 * `hogUrl`: base URL used for links to House of Graphs
 * `showUrlInput`: enables users to fetch PDFs from URLs instead of uploading files.
   It defaults to `false`: browser requests depend on the remote server permitting
   CORS, and a backend proxy that fetches arbitrary URLs introduces security risks
   such as server-side request forgery (SSRF). Enable it only if those trade-offs
   are acceptable; this package does not provide a URL-fetching proxy.
 * `useHogProxy`: defaults to `true`; local extraction uses `/hog-api/enquiry`.
   Set to `false` to contact `https://houseofgraphs.org/api/enquiry` directly,
   e.g. when hosted on that same origin. This does not affect remote backends.

Custom local callbacks must forward their second argument to `harvestFile` to
preserve the component's lookup settings. House of Graphs lookups send detected
graph encodings to that service. Remote mode sends the uploaded PDF to the
configured backend. Failed lookups preserve the extracted graph and report an
error beside its HoG link and in the browser console rather than claiming the
graph is absent. Browsers cannot reliably distinguish CORS failures from other
network failures, so the error mentions both possibilities.

Local extraction now uses PDF.js. The library build emits a worker from the same
pinned PDF.js version; deploy the worker asset alongside the generated library
chunks, and allow it under your site's `worker-src` Content Security Policy.
The demo's Vite build emits the worker under its configured base path. Other
consumer bundlers and real-browser deployments still need verification.

Some PDFs need PDF.js auxiliary resources (CMaps, standard fonts, WebAssembly,
and ICC profiles). They are **not currently bundled automatically**. To enable
these, copy the `cmaps`, `standard_fonts`, `wasm`, and `iccs` directories from
the installed `pdfjs-dist` package to a publicly served directory, preserving
their names and accompanying license files, and forward that directory URL to
`harvestFile`:

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


Licensing
---------

Graph Harvester's own code is available under MIT; this README is CC-BY-4.0.
The distribution includes code under additional permissive licenses, including
PDF.js (Apache-2.0). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
`LICENSES/` for details. Auxiliary PDF.js assets have their own accompanying
license files which must be reviewed when distributing them.


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


