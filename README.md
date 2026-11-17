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

The applet offers two ways to process an uploaded PDF:

- **Browser-local:** PDF processing happens in the user's browser. The applet
  also attempts to look up each detected graph in House of Graphs, as explained
  below.
- **Remote backend:** the PDF is uploaded to a Graph Harvester server for
  processing. This is the default if no `backend` is specified.

### Browser-local extraction

```jsx
import 'bootstrap/dist/css/bootstrap.min.css'
import { GraphHarvesterApplet, harvestFile } from '@hegetim/graph-harvester-react'

export function GraphHarvester() {
  return <GraphHarvesterApplet backend={{ type: 'local', callback: harvestFile }} />
}
```

The PDF stays in the browser for extraction. Graph encodings are sent to House
of Graphs for lookup; the PDF itself is not sent to that service. The lookups
require the proxy configuration described in the next section. If a lookup
fails, the extracted graph is still shown, with an error beside its HoG link and
in the browser console.

### House of Graphs lookups in local mode

[House of Graphs](https://houseofgraphs.org/) is an online database of graphs.
After extracting a graph, the applet asks its API whether the graph has a database
entry and, if so, displays a link. Browser security restrictions (CORS) can
prevent a website from sending that request directly to House of Graphs.

By default, the applet sends lookup requests to **`/hog-api/enquiry` on your own
website**. Your web server must forward requests under `/hog-api/` to
`https://houseofgraphs.org/api/` (for example, `/hog-api/enquiry` becomes
`https://houseofgraphs.org/api/enquiry`). This is a reverse proxy for the House
of Graphs API—not a service included in this package. Configure it in production
or the lookup will fail, although local extraction can still succeed.

For Vite development, a proxy can be configured in the consuming application's
`vite.config.ts`:

```ts
import { defineConfig } from 'vite'

const proxy = {
  '/hog-api': {
    target: 'https://houseofgraphs.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/hog-api/, '/api'),
  },
}

export default defineConfig({
  server: { proxy },  // development server
  preview: { proxy }, // Vite preview server
})
```

Merge this with your existing Vite configuration. It does **not** configure a
production web server. If direct browser requests are permitted by House of
Graphs in your deployment, you can instead set `useHogProxy={false}`. Direct
cross-origin requests may fail because of CORS; the component cannot reliably
distinguish that from other network failures.

### Remote backend

To use a particular Graph Harvester backend instead of local extraction:

```jsx
<GraphHarvesterApplet backend={{ type: 'remote', url: 'https://example.org' }} />
```

The applet sends the uploaded PDF to that backend's `/upload` endpoint. In remote
mode, House of Graphs lookup behavior is controlled by the backend;
`useHogProxy` does not change it.

### PDF.js worker and resources

Local extraction uses PDF.js. The library build emits a worker from the same
pinned PDF.js version; deploy the worker asset alongside the generated library
chunks, and allow it under your site's `worker-src` Content Security Policy.
Verify that your application's bundler includes the worker and that it can be
loaded from your deployment path.

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

### Component options

- `backend`: a local callback or the URL of a remote backend. Without this prop,
  the applet uses its default remote backend.
- `hogUrl`: base URL used for links to House of Graphs; this does not change the
  lookup endpoint.
- `useHogProxy`: in local mode, use the same-origin proxy described above
  (default `true`); set to `false` to try the House of Graphs API directly.
- `showUrlInput`: allow fetching PDFs from URLs instead of uploading files.
  It defaults to `false`: browser requests depend on the remote server permitting
  CORS, and a backend proxy that fetches arbitrary URLs introduces security risks
  such as server-side request forgery (SSRF). This package does not provide a
  URL-fetching proxy.

Custom local callbacks should forward their second argument to `harvestFile`,
so that the applet's lookup settings are preserved, as shown in the PDF.js
resource example above.


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


