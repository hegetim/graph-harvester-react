# PDF.js feasibility probe (migration step 1)

## Result: proceed with an adapter, not a direct substitution

`pdfjs-dist@6.5.438` exposes the information needed to reconstruct the vector
paths used by our six fixtures. Its page-by-page fill/stroke counts match the
current MuPDF extractor, including combined fill-and-stroke operations. All
packed path commands in the fixtures are decoded with finite coordinates;
unknown command codes fail the probe.

A preliminary adapter in `lib/harvester/pdfjs-adapter.ts` now extracts the six
fixtures. Tests compare transformed line/curve points with MuPDF (0.01-unit
precision), and compare graph vertices and edges by coordinates rounded to whole
units, rather than graph6 vertex ordering. These tests do not prove exact bounds
parity, pixel parity, or correctness for arbitrary PDFs. The local harvesting
pipeline now uses PDF.js; MuPDF remains a development-only reference.

Run from the package root:

```sh
npm run test:pdfjs
npm test
```

The pinned release requires Node >=22.13.0 (or >=24); this probe was run on Node
24.22.1. It uses `pdfjs-dist/legacy/build/pdf.mjs` for the Node test environment.
This is not a decision about the future browser import or worker setup.

## Corpus coverage

| Fixture | Pages | Observations |
| --- | ---: | --- |
| `plain.pdf` | 1 | Lines and cubic curves; fills and strokes |
| `multi.pdf` | 3 | Multiple pages and combined painting operations |
| `single_page.pdf` | 1 | Text surrounding a vector drawing inside a Form XObject |
| `multi_page.pdf` | 3 | Multiple Form XObjects and a text-only page with no extracted paths |
| `transforms.pdf` | 1 | Content rotation (~80 degrees), uniform 1.5x scaling, translations, and a Form XObject |
| `exotic.pdf` | 3 | RGB colors, intermediate grays, 30% fill opacity, dash patterns, square caps, miter joins, explicit even-odd clipping, nonzero fill, and a raster image |

`pdfjs-poc.test.ts` compares painting counts against the real MuPDF extractor,
not hand-entered expectations. Its compact snapshots retain page boxes,
rotations, viewport transforms, operator histograms, and decoded command counts.
The original full-pipeline MuPDF snapshots remain unchanged; new baselines are
added for new fixtures.

`exotic.pdf` adds these features to the real-document corpus:

- Page 1: an orange nonzero-winding fill at 30% opacity, blue strokes,
  intermediate gray, dash patterns [4, 2, 1, 2] and [1, 1] (both phase 0).
- Page 2: square line caps and an explicit even-odd clip, represented by
  `eoClip` followed by a clipping-only `endPath` construction.
- Page 3: miter joins, purple fills/strokes, intermediate gray fills, and one
  raster image (`paintImageXObject`). This is useful for the planned full-page
  render/crop previews; the current MuPDF path-only preview omits that image.

A dedicated test guards these operator values in addition to the summary
snapshot and per-page MuPDF paint-count comparison. `pdfjs-preview.test.ts` additionally validates real page rendering, including
image decoding and crop alignment.

The real-document corpus still lacks nonuniform scaling/shear/reflection,
page-level rotation, nested forms, nonzero dash phases, round caps/bevel joins,
and CMYK colors. Some of these are covered by generated PDFs, but preview
rendering and end-to-end PDF.js extraction parity remain future work.

Generated PDFs separately assert exact coordinates, cubic shorthand expansion,
painting semantics, colors, stroke styles, nested save/restore, clipping,
nested forms, opacity, rotated/cropped pages, and malformed-input rejection.
These avoid relying on features merely being present somewhere in a large PDF.

## Observed operator mapping

| PDF.js representation | Adapter responsibility |
| --- | --- |
| `constructPath(paintOp, chunks, minMax)` | Decode commands; apply painting semantics; emit fill and/or stroke records |
| Packed `Float32Array` commands | Reconstruct move, line, cubic, quadratic, and close commands |
| `save`, `restore`, `transform` | Track a graphics-state stack and compose affine matrices |
| `setLineWidth/Cap/Join`, `setMiterLimit`, `setDash` | Preserve width, cap/join, miter limit, dash array and phase |
| `setFillRGBColor`, `setStrokeRGBColor` | Parse CSS hex RGB strings into the internal color representation |
| `setGState` entries `ca`, `CA` | Track separate fill and stroke opacity |
| `clip`, `eoClip` before an `endPath` construct | Retain pending clip semantics; do not count clipping-only paths as painted drawings |
| `paintFormXObjectBegin(matrix, bbox)`, `paintFormXObjectEnd` | Apply nested transforms and form bounding-box clipping with scoped graphics state |
| `page.view`, `page.rotate`, `page.getViewport({scale: 1})` | Normalize crop origin, page rotation, and PDF Y-up coordinates |

In this release `constructPath` includes its painting operation as its first
argument. Painting is not necessarily a separate top-level operator. Combined
fill/stroke must produce two records to match the current extraction model.
Rectangles become move/line/close commands; PDF `v` and `y` shorthand curves
become full cubic commands with explicit control points.

### Version-sensitive path encoding

The packed path command numbers are **not** `OPS.moveTo`, etc. In this pinned
release they are private `DrawOPS` codes:

| Code | Command | Coordinate values following it |
| --- | --- | ---: |
| 0 | moveTo | 2 |
| 1 | lineTo | 2 |
| 2 | curveTo | 6 |
| 3 | quadraticCurveTo | 4 |
| 4 | closePath | 0 |

These were verified against the distributed `makePathFromDrawOPS` implementation
and generated path probes. Quadratic decoding is supported by the probe but no
PDF fixture currently emits that command. The helper is deliberately isolated
in `pdfjs-probe.ts`; an upgrade must rerun and review these tests.

### Coordinates, bounds, and color differences

Paths retain local coordinates. The adapter must apply graphics-state and form
matrices, followed by the page viewport transform, exactly once. The viewport
handles rotation and nonzero page/crop origins. Stroke widths also require
care under scale/shear; transforming points alone is insufficient.

`constructPath` supplies local path bounds, not MuPDF-equivalent transformed
stroke bounds. For example, a 2-unit stroke around a [0, 0, 20, 20] path still
has [0, 0, 20, 20] as its supplied bounds. Tight cubic bounds, caps/joins, and
stroke expansion remain adapter work and require their own tests.

PDF.js normalizes grayscale and CMYK to RGB strings. The CMYK conversion is not
our existing component-threshold calculation; it can affect vertex filtering.
Any behavior differences must be reviewed, not hidden by refreshing snapshots.

## Remaining work / limits

- The engine-independent path/style model now lives in `lib/harvester/drawing-model.ts`.
  `mupdf-adapter.ts` converts extracted paths into this model; detection no
  longer imports MuPDF. The MuPDF preview is a temporary bridge that retains
  original native paths and their display list, including uncommon color spaces.
  Replace that bridge with page rendering and cropping when integrating PDF.js.
- The adapter implements graphics-state replay, painting, conservative
  control-point bounds, and coordinate conversion. Its stroke bounds are
  deliberately approximate and may affect grouping for other PDFs. Compare
  against more PDFs, especially miter joins, hairlines, and nonuniform transforms.
- Preserve subpath/path grouping: current fixture tests compare transformed
  segments and coordinate-normalized graph topology, but cover only this corpus.
- Decide clipping policy explicitly. The current MuPDF extractor ignores clip
  callbacks; PDF.js exposes clipping but does not give us clipped path geometry.
- Test additional color spaces, patterns, shadings, soft masks, optional content,
  annotations, `/UserUnit`, and more unusual PDFs as needed. The PoC does not
  claim support for them. The adapter reports clipping, shading, transparency
  groups, and soft masks. Pattern colors produce a warning and are retained as
  unknown colors for detection; page previews render the original pattern.
  Other unsupported content may still be ignored, so warnings are not an
  exhaustive compatibility check.
- PDF.js loading and cleanup are integrated into the local harvesting pipeline;
  its worker is emitted from the pinned runtime dependency. Test the packaged
  application in real browsers, including worker loading and auxiliary resources.
- The experimental `pdfjs-preview.ts` renders the original PDF page into a
  crop, including images, text, clipping and annotation appearances. It is
  exercised in Node with a test-only native canvas, including pixel comparisons
  with full-page renders at all four page rotations. The PDF.js pipeline uses
  this preview renderer. Verify browser canvas,
  fonts, PDF.js worker/resources and deployment before switching; the native
  test canvas must not become part of the browser bundle. Preview output depends
  on available fonts and PDF.js resource configuration, like a PDF viewer.
- Verify browser worker packaging, ancillary resources, offline/subpath hosting,
  CSP, and document cleanup. Node's worker setup does not validate browser setup.
- Benchmark large PDFs and compare extracted geometry/topology to MuPDF before
  switching the production pipeline.

The probe destroys each loading task in `finally` and supplies owned byte
copies where another engine still needs the input: workers may transfer and
detach buffers. The test setup rejects unexpected fetches, so the fixtures do
not depend on a live service or remote PDF.js assets.
