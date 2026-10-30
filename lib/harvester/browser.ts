import { execute_file } from './pipeline.js'
import type { DetectedGraph } from '../model/Graph.js'

/** Extract graphs from a PDF. Use a same-origin proxy URL if HoG disallows CORS. */
export async function harvestFile(
  file: File,
  options: { hogEnquiryUrl?: string } = {},
): Promise<DetectedGraph[]> {
  return execute_file(await file.arrayBuffer(), { hog: true, ...options })
}
