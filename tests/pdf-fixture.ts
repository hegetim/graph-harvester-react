// Tiny engine-independent PDF writer: one content stream per page, no fonts.
// ASCII-only content keeps byte offsets identical to JavaScript string offsets.
export function pdfFixture(streams: string[]): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] >>`,
  ]
  for (const [index, stream] of streams.entries()) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << >> /Contents ${4 + index * 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    )
  }
  return pdfObjects(objects)
}

// Also supports hand-authored resources (e.g. Form XObjects and ExtGState).
// Objects must use ASCII and reference object 1 as the catalog.
export function patternFixture(): Uint8Array {
  const content = '1 g 1 G q /Pattern cs /P scn /Pattern CS /P SCN ' +
    '10 10 80 80 re B Q 110 10 80 80 re B ' +
    '/Pattern cs /P scn 10 110 80 80 re f 0 g 110 110 80 80 re f'
  const pattern = '0 0 0 rg 0 0 5 10 re f'
  const stream = (data: string, extra = '') => `<< ${extra} /Length ${data.length} >>\nstream\n${data}\nendstream`
  return pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Pattern << /P 5 0 R >> >> /Contents 4 0 R >>',
    stream(content),
    stream(pattern, '/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 10 10] /XStep 10 /YStep 10 /Resources << >>'),
  ])
}

export function pdfObjects(objects: string[]): Uint8Array {
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}
