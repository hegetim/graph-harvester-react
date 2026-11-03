# Regression tests

Run from the package root (`lib/` in the workspace):

```sh
npm ci
npm test                 # single run, suitable for CI
npm run test:watch       # rerun affected tests while editing
npm run typecheck       # library, build config, and tests
npm run build           # type checks followed by production library build
```

The suite uses Vitest in Node with the real MuPDF/WASM extraction pipeline.
It does not require a browser or a live House of Graphs backend. `setup.ts`
blocks unexpected fetches; lookup tests supply explicit responses.

## Coverage

- `pipeline.test.ts`: full PDF-to-DetectedGraph regression snapshots for
  `assets/plain.pdf`, `assets/multi.pdf`, `assets/single_page.pdf`, and
  `assets/multi_page.pdf`, PNG signatures, typed-array and
  ArrayBuffer inputs, malformed PDFs, blank pages, page ordering, and preservation
  of extraction results when HoG lookup fails.
- `geometry.test.ts`: coordinate transforms (including rotation and PDF Y-axis
  inversion), vertex bounds, statistics, and point comparisons.
- `graph.test.ts`: adjacency matrices, graph6 encoding, edge deduplication,
  and HoG lookup success, absence, HTTP failure, and network failure.
- `browser.test.ts`: File conversion, lookup options, and error propagation.
- `pdf-fixture.ts`: small engine-independent PDF generator for controlled
  blank-page and multi-page cases.

## Baselines and the PDF.js migration

Snapshots record the **current MuPDF behavior**, not a claim that every current
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
All four existing PDF fixtures are baselined. The suite does not silently skip
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
