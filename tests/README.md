# Regression tests

Run from the package root (`lib/` in the workspace):

```sh
npm ci
npm test                 # single run, suitable for CI
npm run test:watch       # rerun affected tests while editing
npm run test:pdfjs       # PDF.js feasibility probes only
npm run typecheck       # library, build config, and tests
npm run build           # type checks followed by production library build
```

The suite uses Vitest in Node with the PDF.js pipeline and retains MuPDF/WASM
as a regression reference. PDF.js requires Node >=22.13.0 (or >=24).
It does not require a browser or a live House of Graphs backend. `setup.ts`
blocks unexpected fetches; lookup tests supply explicit responses.

## Coverage

- `pipeline.test.ts`: MuPDF reference snapshots and PDF.js end-to-end pipeline
  tests for
  `assets/plain.pdf`, `assets/multi.pdf`, `assets/single_page.pdf`,
  `assets/multi_page.pdf`, `assets/transforms.pdf`, and `assets/exotic.pdf`;
  PNG signatures, typed-array and
  ArrayBuffer inputs, malformed PDFs, blank pages, page ordering, and preservation
  of extraction results when HoG lookup fails.
- `geometry.test.ts`: coordinate transforms (including rotation and PDF Y-axis
  inversion), vertex bounds, statistics, and point comparisons.
- `graph.test.ts`: adjacency matrices, graph6 encoding, edge deduplication,
  and HoG lookup success, absence, HTTP failure, and network failure.
- `browser.test.ts`: File conversion, lookup options, and error propagation.
- `stroke-style.test.ts`: value-based stroke similarity, including dash-array
  contents and lengths, using styles extracted from generated PDFs.
- `fill-rule.test.ts`: preservation of explicit fill rules during extraction,
  plus preview pixel checks for nonzero, even-odd, and default fills.
- `drawing-model.test.ts`: conversion from MuPDF to engine-independent path
  commands, colors, stroke styles and transforms, including preview lifetime.
- `pdfjs-preview.test.ts`: cropped PDF.js page rendering, including text,
  raster images, annotations, crop boxes, rotation, pixel limits and an
  extraction-to-DetectedGraph integration test (Node canvas).
- `pdfjs-adapter.test.ts`: PDF.js adapter extraction, graphics state and form
  transforms, warnings, and comparisons with MuPDF for all fixture paths and
  coordinate-normalized graph topology. This does not test preview rendering.
- `pdfjs-poc.test.ts` / `pdfjs-probe.ts`: pinned, test-only PDF.js operator-list
  probes against all six fixtures and generated PDFs. See
  [PDFJS-POC.md](PDFJS-POC.md) for findings, operator mapping, and remaining risks.
- `pdf-fixture.ts`: small engine-independent PDF generator for controlled
  pages, forms, graphics states, and resource dictionaries.

## Baselines and the PDF.js migration

Reference snapshots record the **MuPDF behavior**, not a claim that every current
result is correct. They retain graph6 strings, drawing order, bounding boxes,
vertex/edge geometry, and lookup defaults. Coordinates are rounded to 0.001 PDF
units to ignore insignificant floating-point differences. Preview PNG bytes are
not snapshotted because different renderers can produce different valid images.

During migration, keep these tests unchanged initially. Investigate failures:
coordinate transforms, curve conversion, stroke bounds, and drawing order can
all affect graph detection. Review intentional changes before updating:

```sh
npm run test:update
# Review tests/__snapshots__/pipeline.test.ts.snap in the diff.
```

Add new representative PDFs to `assets/` and the fixture list in
`pipeline.test.ts`; only use fixtures that may be redistributed in the repository.
All six existing PDF fixtures are baselined. The suite does not silently skip
unreadable fixtures.

## Build/package isolation

`vitest.config.ts` is separate from `vite.config.ts`, so tests do not load the
library's CSS/declaration build plugins. The production TypeScript project
includes only `lib/` and explicitly excludes `tests/`; tests have their own
no-emit TypeScript project. The library entry point remains
`lib/graph-harvester-react.ts`. The npm `files` allowlist includes only `dist`
(plus npm's automatically included metadata, README, and LICENSE).

Verify the release file list with `npm pack --dry-run`: tests, PDF fixtures,
snapshots, and Vitest configuration must not appear.
