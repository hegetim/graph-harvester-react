import { execute_file } from './pipeline.js'
import type { DetectedGraph } from '../model/Graph.js'

/** Extract graphs from a PDF. Use a same-origin proxy URL if HoG disallows CORS. */
export async function harvestFile(
  file: File,
  options: { hogEnquiryUrl?: string; pdfjsAssetsUrl?: string } = {},
): Promise<DetectedGraph[]> {
  const { hogEnquiryUrl, pdfjsAssetsUrl } = options
  const base = pdfjsAssetsUrl ? `${pdfjsAssetsUrl.replace(/\/+$/, '')}/` : undefined
  return execute_file(await file.arrayBuffer(), {
    hog: true,
    ...(hogEnquiryUrl === undefined ? {} : { hogEnquiryUrl }),
    ...(base ? { pdfOptions: {
      cMapUrl: `${base}cmaps/`, standardFontDataUrl: `${base}standard_fonts/`,
      wasmUrl: `${base}wasm/`, iccUrl: `${base}iccs/`,
    } } : {}),
  })
}
